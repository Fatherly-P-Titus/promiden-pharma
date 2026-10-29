const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();

router.get('/site-settings', async (_req, res) => {
  const { data, error } = await supabase.from('site_settings').select('brand_name,hero_title,hero_description,email,phone,facebook,twitter,instagram').eq('id', 1).maybeSingle();
  if (error) return res.status(503).json({ success: false, message: 'Public site settings are temporarily unavailable.' });
  const row = data || {};
  res.json({
    brandName: row.brand_name || 'PROMIDEN',
    heroTitle: row.hero_title || 'Better health starts with trusted care.',
    heroDescription: row.hero_description || 'Your partner in pharmaceutical products, responsible medicine distribution, and healthcare consultancy.',
    email: row.email || '', phone: row.phone || '',
    socialLinks: { facebook: row.facebook || '', twitter: row.twitter || '', instagram: row.instagram || '' }
  });
});

router.get('/products', async (_req, res) => {
  const { data, error } = await supabase.from('products').select('id,name,description,category,price,price_minor,image_url,published,sort_order').eq('published', true).order('sort_order').order('created_at');
  if (error) return res.status(503).json({ success: false, message: 'Products are temporarily unavailable.' });
  res.json((data || []).map((item) => ({ ...item, imageUrl: item.image_url || '' })));
});

router.get('/services', async (_req, res) => {
  const { data, error } = await supabase.from('services').select('id,title,description,price_minor,image_url,published,sort_order').eq('published', true).order('sort_order').order('created_at');
  if (error) return res.status(503).json({ success: false, message: 'Services are temporarily unavailable.' });
  res.json((data || []).map((item) => ({ ...item, imageUrl: item.image_url || '' })));
});
module.exports = router;
