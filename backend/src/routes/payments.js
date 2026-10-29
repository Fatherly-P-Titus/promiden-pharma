const express = require('express');
const { randomUUID, randomBytes } = require('node:crypto');
const { supabase } = require('../config/supabase');
const router = express.Router();

const MAX_LINES = 50;
const MAX_QUANTITY = 1000;
const PAYSTACK_API = 'https://api.paystack.co';
const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const cleanText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emailIsValid = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const moneyIsSafe = (value) => Number.isSafeInteger(value) && value > 0;

function publicOrder(order) {
  return { id: order.id, orderNumber: order.order_number, currency: order.currency, subtotalMinor: Number(order.subtotal_minor), totalMinor: Number(order.total_minor), orderStatus: order.order_status, paymentStatus: order.payment_status, createdAt: order.created_at };
}
function fail(res, status, message) { return res.status(status).json({ success: false, message }); }

async function getAuthoritativeItems(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > MAX_LINES) throw Object.assign(new Error(`Choose between 1 and ${MAX_LINES} order items.`), { status: 400 });
  const normalized = new Map();
  for (const line of lines) {
    if (!line || !['product', 'service'].includes(line.type) || !isUuid(line.id) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      throw Object.assign(new Error('One or more order items are invalid. Refresh the catalogue and try again.'), { status: 400 });
    }
    const key = `${line.type}:${line.id}`;
    normalized.set(key, (normalized.get(key) || 0) + line.quantity);
    if (normalized.get(key) > MAX_QUANTITY) throw Object.assign(new Error('An item quantity exceeds the allowed limit.'), { status: 400 });
  }
  const productsIds = [...normalized.keys()].filter(k => k.startsWith('product:')).map(k => k.slice(8));
  const servicesIds = [...normalized.keys()].filter(k => k.startsWith('service:')).map(k => k.slice(8));
  const lookups = await Promise.all([
    productsIds.length ? supabase.from('products').select('id,name,description,price_minor,published').in('id', productsIds).eq('published', true) : Promise.resolve({ data: [], error: null }),
    servicesIds.length ? supabase.from('services').select('id,title,description,price_minor,published').in('id', servicesIds).eq('published', true) : Promise.resolve({ data: [], error: null })
  ]);
  if (lookups.some(result => result.error)) throw Object.assign(new Error('The catalogue is temporarily unavailable. Please try again later.'), { status: 503 });
  const rows = new Map();
  for (const item of lookups[0].data || []) rows.set(`product:${item.id}`, { type: 'product', id: item.id, name: item.name, description: item.description || '', price: Number(item.price_minor) });
  for (const item of lookups[1].data || []) rows.set(`service:${item.id}`, { type: 'service', id: item.id, name: item.title, description: item.description || '', price: Number(item.price_minor) });
  const result = [];
  let total = 0;
  for (const [key, quantity] of normalized) {
    const item = rows.get(key);
    if (!item) throw Object.assign(new Error('An item is no longer available. Refresh the catalogue and review your order.'), { status: 409 });
    if (!moneyIsSafe(item.price)) throw Object.assign(new Error('An item does not have a valid online price yet. Please contact Promiden.'), { status: 409 });
    const lineTotal = item.price * quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal) || total + lineTotal > 1000000000) throw Object.assign(new Error('The order total exceeds Paystack’s supported online payment limit.'), { status: 400 });
    total += lineTotal;
    result.push({ ...item, quantity, lineTotal });
  }
  if (total < 5000) throw Object.assign(new Error('The minimum online payment amount is ₦50.00. Please contact Promiden for smaller orders.'), { status: 400 });
  return { items: result, total };
}

router.post('/orders', async (req, res) => {
  try {
    const customerName = cleanText(req.body?.customer?.name, 120);
    const customerEmail = cleanText(req.body?.customer?.email, 254).toLowerCase();
    const customerPhone = cleanText(req.body?.customer?.phone, 30);
    const customerNote = cleanText(req.body?.customer?.note, 500);
    if (!customerName || !customerPhone || !emailIsValid(customerEmail)) return fail(res, 400, 'Provide a valid name, email address, and phone number.');
    const idempotencyKey = cleanText(req.get('Idempotency-Key') || req.body?.idempotencyKey, 100);
    if (idempotencyKey && !/^[a-zA-Z0-9._:-]{8,100}$/.test(idempotencyKey)) return fail(res, 400, 'The order request key is invalid. Refresh the page and try again.');
    if (idempotencyKey) {
      const { data: existing, error: existingError } = await supabase.from('orders').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        if (existing.customer_email !== customerEmail) return fail(res, 409, 'This order request key has already been used. Refresh the page and try again.');
        return res.status(200).json({ success: true, order: publicOrder(existing), reused: true });
      }
    }
    const { items, total } = await getAuthoritativeItems(req.body?.items);
    const types = new Set(items.map(item => item.type));
    const orderType = types.size > 1 ? 'mixed' : (types.has('product') ? 'products' : 'services');
    const orderNumber = `PMD-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const orderPayload = {
      order_number: orderNumber, idempotency_key: idempotencyKey || null,
      customer_email: customerEmail, customer_name: customerName, customer_phone: customerPhone,
      order_type: orderType, currency: 'NGN', subtotal_minor: total, total_minor: total,
      order_status: 'awaiting_payment', payment_status: 'pending', customer_note: customerNote
    };
    const { data: order, error: orderError } = await supabase.from('orders').insert(orderPayload).select('*').single();
    if (orderError) {
      if (idempotencyKey && orderError.code === '23505') {
        const { data: duplicate } = await supabase.from('orders').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
        if (duplicate) return res.status(200).json({ success: true, order: publicOrder(duplicate), reused: true });
      }
      throw orderError;
    }
    const itemRows = items.map(item => ({
      order_id: order.id, item_type: item.type,
      product_id: item.type === 'product' ? item.id : null,
      service_id: item.type === 'service' ? item.id : null,
      item_name_snapshot: cleanText(item.name, 200) || (item.type === 'product' ? 'Product' : 'Service'),
      item_description_snapshot: cleanText(item.description, 2000), quantity: item.quantity,
      unit_price_minor: item.price, line_total_minor: item.lineTotal
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }
    return res.status(201).json({ success: true, order: publicOrder(order) });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error('Order creation failed:', error.message || error);
    return fail(res, status, status === 500 ? 'The order could not be saved. Please try again later.' : error.message);
  }
});

router.post('/payments/initialize', async (req, res) => {
  try {
    const orderId = req.body?.orderId;
    if (!isUuid(orderId)) return fail(res, 400, 'A valid order ID is required.');
    if (!process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY.startsWith('YOUR_')) return fail(res, 503, 'Online payment is not configured yet. Please contact Promiden.');
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return fail(res, 404, 'Order not found. Please review your order again.');
    if (order.payment_status === 'successful' || order.order_status !== 'awaiting_payment') return fail(res, 409, 'This order is not awaiting payment.');
    const amount = Number(order.total_minor);
    if (!moneyIsSafe(amount) || order.currency !== 'NGN') return fail(res, 409, 'The order amount is not valid for online payment.');
    const reference = `pmd_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const origin = (process.env.APP_ORIGIN || '').replace(/\/$/, '');
    if (!origin || !/^https?:\/\//i.test(origin)) return fail(res, 503, 'The payment callback URL is not configured. Please contact Promiden.');
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: order.customer_email, amount: String(amount), currency: 'NGN', reference, callback_url: `${origin}/payment.html`, metadata: { order_id: order.id, order_number: order.order_number, custom_fields: [{ display_name: 'Order Number', variable_name: 'order_number', value: order.order_number }] } }),
      signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.status || !payload?.data?.authorization_url || payload.data.reference !== reference) {
      console.error('Paystack initialization rejected:', payload?.message || response.status);
      return fail(res, 502, 'Secure checkout could not be started. Please try again shortly.');
    }
    const { error: transactionError } = await supabase.from('payment_transactions').insert({
      order_id: order.id, provider: 'paystack', provider_reference: reference,
      amount_minor: amount, currency: 'NGN', status: 'pending', authorization_url: payload.data.authorization_url
    });
    if (transactionError) throw transactionError;
    return res.status(200).json({ success: true, order: { id: order.id, orderNumber: order.order_number, totalMinor: amount, currency: 'NGN' }, payment: { provider: 'paystack', reference, authorizationUrl: payload.data.authorization_url } });
  } catch (error) {
    console.error('Payment initialization failed:', error.message || error);
    return fail(res, 502, 'Secure checkout could not be started. Please try again shortly.');
  }
});


function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]{128}$/i.test(a) || !/^[a-f0-9]{128}$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex'); const right = Buffer.from(b, 'hex');
  return left.length === right.length && require('node:crypto').timingSafeEqual(left, right);
}

async function verifyWithPaystack(reference) {
  const response = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status || !payload?.data) throw Object.assign(new Error('Paystack verification is temporarily unavailable.'), { status: 502 });
  return payload.data;
}

async function applyVerifiedTransaction(data) {
  const reference = typeof data?.reference === 'string' ? data.reference : '';
  if (!reference) return { outcome: 'ignored' };
  const { data: tx, error: txLookupError } = await supabase.from('payment_transactions').select('*').eq('provider_reference', reference).maybeSingle();
  if (txLookupError) throw txLookupError;
  if (!tx) return { outcome: 'unmatched' };
  const { data: order, error: orderLookupError } = await supabase.from('orders').select('*').eq('id', tx.order_id).maybeSingle();
  if (orderLookupError) throw orderLookupError;
  if (!order) return { outcome: 'unmatched' };

  const amountMatches = Number(data.amount) === Number(tx.amount_minor) && Number(data.amount) === Number(order.total_minor);
  const currencyMatches = data.currency === 'NGN' && tx.currency === 'NGN' && order.currency === 'NGN';
  const referenceMatches = data.reference === tx.provider_reference;
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : 'unknown';
  const success = status === 'success' && amountMatches && currencyMatches && referenceMatches;
  const now = new Date().toISOString();

  if (status === 'success' && !success) {
    await supabase.from('payment_transactions').update({ status: 'failed', verified_at: now, gateway_response: 'Verification mismatch: status, amount, currency, or reference did not match stored records.', updated_at: now }).eq('id', tx.id).neq('status', 'successful');
    return { outcome: 'mismatch' };
  }

  if (success) {
    // Do not downgrade a previously successful payment; retries and webhook/callback races are expected.
    const { error: updateTxError } = await supabase.from('payment_transactions').update({
      status: 'successful', provider_transaction_id: data.id == null ? null : String(data.id),
      channel: typeof data.channel === 'string' ? data.channel.slice(0, 80) : null,
      gateway_response: typeof data.gateway_response === 'string' ? data.gateway_response.slice(0, 200) : 'Successful transaction verified with Paystack.',
      verified_at: now, successful_at: tx.successful_at || now, updated_at: now
    }).eq('id', tx.id);
    if (updateTxError) throw updateTxError;
    const { error: updateOrderError } = await supabase.from('orders').update({ payment_status: 'successful', order_status: order.order_status === 'awaiting_payment' ? 'confirmed' : order.order_status, paid_at: order.paid_at || now, updated_at: now }).eq('id', order.id);
    if (updateOrderError) throw updateOrderError;
    return { outcome: 'successful', orderId: order.id, orderNumber: order.order_number };
  }

  const allowedStatuses = new Set(['failed', 'abandoned', 'ongoing', 'pending', 'processing', 'reversed', 'queued']);
  const mappedStatus = allowedStatuses.has(status) && !['queued', 'processing'].includes(status) ? status : 'pending';
  const { error: updateTxError } = await supabase.from('payment_transactions').update({ status: mappedStatus, verified_at: now, gateway_response: typeof data.gateway_response === 'string' ? data.gateway_response.slice(0, 200) : null, updated_at: now }).eq('id', tx.id).neq('status', 'successful');
  if (updateTxError) throw updateTxError;
  if (['failed', 'abandoned', 'reversed'].includes(mappedStatus) && order.payment_status !== 'successful') {
    const orderPaymentStatus = mappedStatus === 'abandoned' ? 'cancelled' : mappedStatus === 'reversed' ? 'refunded' : 'failed';
    const { error: updateOrderError } = await supabase.from('orders').update({ payment_status: orderPaymentStatus, updated_at: now }).eq('id', order.id).neq('payment_status', 'successful');
    if (updateOrderError) throw updateOrderError;
  }
  return { outcome: mappedStatus, orderId: order.id, orderNumber: order.order_number };
}

// The callback is a convenience for the customer. It calls Paystack from the server and
// never trusts the browser redirect as evidence of payment.
router.get('/payments/verify/:reference', async (req, res) => {
  try {
    const reference = typeof req.params.reference === 'string' ? req.params.reference : '';
    if (!/^pmd_[a-zA-Z0-9_-]{8,100}$/.test(reference)) return fail(res, 400, 'The payment reference is invalid.');
    if (!process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY.startsWith('YOUR_')) return fail(res, 503, 'Payment verification is not configured yet.');
    const verified = await verifyWithPaystack(reference);
    const result = await applyVerifiedTransaction(verified);
    if (result.outcome === 'unmatched' || result.outcome === 'mismatch') return fail(res, 409, 'We could not match this transaction to the expected order. Please contact Promiden for assistance.');
    return res.json({ success: true, status: result.outcome, orderNumber: result.orderNumber || null, message: result.outcome === 'successful' ? 'Payment confirmed.' : 'Payment is not confirmed as successful yet.' });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    if (status >= 500) console.error('Payment verification failed:', error.message || error);
    return fail(res, status, status === 502 ? 'Payment verification is temporarily unavailable. Please try again later.' : error.message);
  }
});

// Paystack webhook: authenticate the exact raw request body before trusting its event data.
router.post('/webhooks/paystack', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || secret.startsWith('YOUR_') || !Buffer.isBuffer(req.rawBody)) return res.status(503).json({ success: false });
  const expected = require('node:crypto').createHmac('sha512', secret).update(req.rawBody).digest('hex');
  if (!safeEqualHex(expected, req.get('x-paystack-signature'))) return res.status(401).json({ success: false });
  const event = req.body;
  const eventType = typeof event?.event === 'string' ? event.event : '';
  const reference = typeof event?.data?.reference === 'string' ? event.data.reference : null;
  const eventIdentity = event?.data?.id != null ? String(event.data.id) : (reference || 'unknown');
  const eventKey = `paystack:${eventType}:${eventIdentity}`.slice(0, 250);
  try {
    let { data: savedEvent, error: eventError } = await supabase.from('payment_events').insert({ event_key: eventKey, event_type: eventType || 'unknown', provider_reference: reference, processing_status: 'received' }).select('id,processing_status').single();
    if (eventError?.code === '23505') {
      const existingResult = await supabase.from('payment_events').select('id,processing_status').eq('event_key', eventKey).maybeSingle();
      if (existingResult.error) throw existingResult.error;
      if (!existingResult.data) throw eventError;
      if (['processed', 'ignored'].includes(existingResult.data.processing_status)) return res.status(200).json({ received: true, duplicate: true });
      savedEvent = existingResult.data;
      const reset = await supabase.from('payment_events').update({ processing_status: 'received', error_summary: null }).eq('id', savedEvent.id);
      if (reset.error) throw reset.error;
    } else if (eventError) throw eventError;
    let outcome = 'ignored';
    if (eventType === 'charge.success' && event?.data) {
      const result = await applyVerifiedTransaction(event.data);
      outcome = result.outcome === 'successful' ? 'processed' : (result.outcome === 'unmatched' || result.outcome === 'mismatch' ? 'failed' : 'ignored');
    }
    const { error: eventUpdateError } = await supabase.from('payment_events').update({ processing_status: outcome, processed_at: new Date().toISOString(), error_summary: outcome === 'failed' ? 'Transaction could not be matched to the stored order and payment.' : null }).eq('id', savedEvent.id);
    if (eventUpdateError) throw eventUpdateError;
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing failed:', error.message || error);
    // Non-2xx asks Paystack to retry delivery. Existing event key can be retried by ops after repair.
    return res.status(500).json({ received: false });
  }
});

module.exports = router;
