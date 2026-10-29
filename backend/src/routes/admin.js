const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { supabase } = require('../config/supabase');
const { requireAdmin, requireSameOrigin } = require('../middleware/auth');
const { text, optionalUrl, idOrNew, respondError } = require('../utils/validation');
const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Try again in 15 minutes.' } });
const usernamePattern = /^[a-zA-Z0-9._-]{3,100}$/;

router.get('/session', (req, res) => {
  if (!req.session?.admin) return res.status(401).json({ success: false, authenticated: false });
  res.json({ success: true, authenticated: true, admin: { id: req.session.admin.id, username: req.session.admin.username } });
});

router.post('/login', loginLimiter, requireSameOrigin, async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password || username.length > 100 || password.length > 256) return res.status(400).json({ success: false, message: 'Enter a valid username and password.' });
  const normalized = username.toLowerCase();
  const { data: admin, error } = await supabase.from('admin_users').select('id,username,password_hash,is_active').eq('username_normalized', normalized).maybeSingle();
  if (error) return res.status(503).json({ success: false, message: 'Authentication service is temporarily unavailable.' });
  const matches = admin?.is_active && await bcrypt.compare(password, admin.password_hash).catch(() => false);
  if (!matches) return res.status(401).json({ success: false, message: 'The username or password is incorrect, or this account is inactive.' });
  await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', admin.id);
  req.session.regenerate((sessionError) => {
    if (sessionError) return res.status(500).json({ success: false, message: 'Could not establish a secure session.' });
    req.session.admin = { id: admin.id, username: admin.username };
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ success: false, message: 'Could not save the administrator session.' });
      res.json({ success: true, admin: { id: admin.id, username: admin.username } });
    });
  });
});

router.post('/logout', requireSameOrigin, (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ success: false, message: 'Could not end the session.' });
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'promiden.sid', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    res.json({ success: true });
  });
});

router.use(requireAdmin);
router.use(requireSameOrigin);

router.get('/site-settings', async (_req, res) => {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return res.status(503).json({ success: false, message: 'Settings could not be loaded.' });
  res.json({ success: true, settings: data || {} });
});
router.put('/site-settings', async (req, res) => {
  try {
    const body = req.body || {};
    const row = {
      id: 1,
      brand_name: text(body.brandName, 100, 'Brand name', { required: true }),
      hero_title: text(body.heroTitle, 180, 'Hero title', { required: true }),
      hero_description: text(body.heroDescription, 1200, 'Hero description', { required: true }),
      email: text(body.email, 254, 'Email'), phone: text(body.phone, 60, 'Phone'),
      facebook: optionalUrl(body.facebook, 'Facebook URL'), twitter: optionalUrl(body.twitter, 'X/Twitter URL'), instagram: optionalUrl(body.instagram, 'Instagram URL'),
      updated_at: new Date().toISOString(), updated_by: req.session.admin.id
    };
    const { data, error } = await supabase.from('site_settings').upsert(row).select().single();
    if (error) return res.status(503).json({ success: false, message: 'Settings could not be saved.' });
    res.json({ success: true, settings: data });
  } catch (error) { respondError(res, error); }
});

function collectionRoutes(kind) {
  const table = kind;
  const isProduct = kind === 'products';
  router.get(`/${table}`, async (_req, res) => {
    const { data, error } = await supabase.from(table).select('*').order('sort_order').order('created_at');
    if (error) return res.status(503).json({ success: false, message: `Could not load ${table}.` });
    res.json({ success: true, items: data || [] });
  });
  router.post(`/${table}`, async (req, res) => {
    try {
      const body = req.body || {};
      const row = {
        id: idOrNew(body.id), description: text(body.description, 700, 'Description', { required: true }),
        image_url: optionalUrl(body.imageUrl || body.image_url, 'Image URL'),
        published: body.published !== false, sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
        updated_at: new Date().toISOString()
      };
      if (isProduct) {
        row.name = text(body.name, 140, 'Product name', { required: true });
        row.category = text(body.category, 100, 'Category');
        row.price = text(body.price, 80, 'Price');
      } else row.title = text(body.title, 140, 'Service title', { required: true });
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) return res.status(400).json({ success: false, message: `Could not create ${isProduct ? 'product' : 'service'}. Check that the fields are valid.` });
      res.status(201).json({ success: true, item: data });
    } catch (error) { respondError(res, error); }
  });
  router.put(`/${table}/:id`, async (req, res) => {
    try {
      const body = req.body || {};
      const row = {
        description: text(body.description, 700, 'Description', { required: true }), image_url: optionalUrl(body.imageUrl || body.image_url, 'Image URL'),
        published: body.published !== false, sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0, updated_at: new Date().toISOString()
      };
      if (isProduct) { row.name = text(body.name, 140, 'Product name', { required: true }); row.category = text(body.category, 100, 'Category'); row.price = text(body.price, 80, 'Price'); }
      else row.title = text(body.title, 140, 'Service title', { required: true });
      const { data, error } = await supabase.from(table).update(row).eq('id', req.params.id).select().maybeSingle();
      if (error) return res.status(400).json({ success: false, message: 'Could not update this item.' });
      if (!data) return res.status(404).json({ success: false, message: 'Item not found.' });
      res.json({ success: true, item: data });
    } catch (error) { respondError(res, error); }
  });
  router.delete(`/${table}/:id`, async (req, res) => {
    const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, message: 'Could not remove this item.' });
    if (count === 0) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true });
  });
}
collectionRoutes('products');
collectionRoutes('services');

router.get('/administrators', async (_req, res) => {
  const { data, error } = await supabase.from('admin_users').select('id,username,is_active,created_at,last_login_at').order('created_at');
  if (error) return res.status(503).json({ success: false, message: 'Administrator accounts could not be loaded.' });
  res.json({ success: true, administrators: data || [] });
});
router.post('/administrators', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!usernamePattern.test(username)) return res.status(400).json({ success: false, message: 'Username must be 3–100 characters and use letters, numbers, dots, underscores, or hyphens.' });
  if (password.length < 12 || password.length > 256) return res.status(400).json({ success: false, message: 'Password must be between 12 and 256 characters.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('admin_users').insert({ username, username_normalized: username.toLowerCase(), password_hash: passwordHash, is_active: true }).select('id,username,is_active,created_at').single();
  if (error) return res.status(409).json({ success: false, message: 'Could not create account. The username may already exist.' });
  res.status(201).json({ success: true, administrator: data });
});
router.delete('/administrators/:id', async (req, res) => {
  if (req.params.id === req.session.admin.id) return res.status(400).json({ success: false, message: 'You cannot remove the account currently signed in.' });
  const { count, error: countError } = await supabase.from('admin_users').select('id', { count: 'exact', head: true }).eq('is_active', true);
  if (countError) return res.status(503).json({ success: false, message: 'Could not verify administrator count.' });
  if ((count || 0) <= 1) return res.status(400).json({ success: false, message: 'At least one active administrator must remain.' });
  const { data, error } = await supabase.from('admin_users').delete().eq('id', req.params.id).select('id').maybeSingle();
  if (error) return res.status(400).json({ success: false, message: 'Could not remove this account.' });
  if (!data) return res.status(404).json({ success: false, message: 'Administrator account not found.' });
  res.json({ success: true });
});


// Order and payment operations. Payment status is read-only here: only verified Paystack
// callbacks/webhooks may confirm a payment. Administrators manage fulfilment status only.
const orderStatuses = new Set(['awaiting_payment', 'confirmed', 'processing', 'fulfilled', 'cancelled']);
const paymentStatuses = new Set(['pending', 'successful', 'failed', 'cancelled', 'refunded']);
const orderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function orderSummary(order) {
  return { id: order.id, orderNumber: order.order_number, customerName: order.customer_name, customerEmail: order.customer_email,
    customerPhone: order.customer_phone, orderType: order.order_type, currency: order.currency,
    subtotalMinor: Number(order.subtotal_minor), totalMinor: Number(order.total_minor), orderStatus: order.order_status,
    paymentStatus: order.payment_status, customerNote: order.customer_note, createdAt: order.created_at,
    updatedAt: order.updated_at, paidAt: order.paid_at, cancelledAt: order.cancelled_at };
}
router.get('/orders', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
  const orderStatus = typeof req.query.order_status === 'string' ? req.query.order_status : '';
  const paymentStatus = typeof req.query.payment_status === 'string' ? req.query.payment_status : '';
  if ((orderStatus && !orderStatuses.has(orderStatus)) || (paymentStatus && !paymentStatuses.has(paymentStatus)))
    return res.status(400).json({ success: false, message: 'The requested order or payment status filter is invalid.' });
  let query = supabase.from('orders').select('id,order_number,customer_name,customer_email,customer_phone,order_type,currency,subtotal_minor,total_minor,order_status,payment_status,created_at,updated_at,paid_at,cancelled_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (orderStatus) query = query.eq('order_status', orderStatus);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);
  const { data, error, count } = await query;
  if (error) return res.status(503).json({ success: false, message: 'Orders could not be loaded.' });
  return res.json({ success: true, orders: (data || []).map(orderSummary), pagination: { limit, offset, total: count || 0 } });
});
router.get('/orders/:id', async (req, res) => {
  if (!orderUuid.test(req.params.id)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(503).json({ success: false, message: 'Order details could not be loaded.' });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  const [itemsResult, transactionsResult] = await Promise.all([
    supabase.from('order_items').select('id,item_type,item_name_snapshot,item_description_snapshot,quantity,unit_price_minor,line_total_minor').eq('order_id', order.id).order('created_at'),
    supabase.from('payment_transactions').select('id,provider,provider_reference,provider_transaction_id,amount_minor,currency,status,channel,gateway_response,initialized_at,verified_at,successful_at,created_at,updated_at').eq('order_id', order.id).order('created_at', { ascending: false })
  ]);
  if (itemsResult.error || transactionsResult.error) return res.status(503).json({ success: false, message: 'Order items or payment history could not be loaded.' });
  return res.json({ success: true, order: orderSummary(order), items: (itemsResult.data || []).map(item => ({ id: item.id, type: item.item_type, name: item.item_name_snapshot, description: item.item_description_snapshot, quantity: item.quantity, unitPriceMinor: Number(item.unit_price_minor), lineTotalMinor: Number(item.line_total_minor) })), transactions: (transactionsResult.data || []).map(tx => ({ id: tx.id, provider: tx.provider, reference: tx.provider_reference, transactionId: tx.provider_transaction_id, amountMinor: Number(tx.amount_minor), currency: tx.currency, status: tx.status, channel: tx.channel, gatewayResponse: tx.gateway_response, initializedAt: tx.initialized_at, verifiedAt: tx.verified_at, successfulAt: tx.successful_at, createdAt: tx.created_at, updatedAt: tx.updated_at })) });
});
router.patch('/orders/:id/status', async (req, res) => {
  if (!orderUuid.test(req.params.id)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
  const status = typeof req.body?.orderStatus === 'string' ? req.body.orderStatus : '';
  if (!['processing', 'fulfilled', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Choose processing, fulfilled, or cancelled.' });
  const { data: order, error: lookupError } = await supabase.from('orders').select('*').eq('id', req.params.id).maybeSingle();
  if (lookupError) return res.status(503).json({ success: false, message: 'Order could not be loaded.' });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (status === 'cancelled' && order.payment_status === 'successful') return res.status(409).json({ success: false, message: 'This order has a successful payment. Handle any refund through Paystack first; this endpoint cannot cancel paid orders.' });
  if (['processing', 'fulfilled'].includes(status) && order.payment_status !== 'successful') return res.status(409).json({ success: false, message: 'Only successfully paid orders can move to processing or fulfilled.' });
  if (order.order_status === 'cancelled' && status !== 'cancelled') return res.status(409).json({ success: false, message: 'A cancelled order cannot be reopened from this screen.' });
  const now = new Date().toISOString();
  const update = { order_status: status, updated_at: now };
  if (status === 'cancelled') update.cancelled_at = order.cancelled_at || now;
  const { data: updated, error } = await supabase.from('orders').update(update).eq('id', order.id).select('*').single();
  if (error) return res.status(503).json({ success: false, message: 'Order status could not be updated.' });
  return res.json({ success: true, order: orderSummary(updated) });
});

module.exports = router;
