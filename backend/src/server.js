require('dotenv').config();
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { validateEnv } = require('./config/env');
const { createSessionMiddleware, pool } = require('./config/session');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');

validateEnv();
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://code.jquery.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://*.supabase.co'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
const allowedOrigins = new Set([process.env.APP_ORIGIN, process.env.FRONTEND_ORIGIN].filter(Boolean).map(value => value.replace(/\/$/, '')));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.has(origin.replace(/\/$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,Idempotency-Key,X-Requested-With');
  }
  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin.replace(/\/$/, ''))) return res.status(403).end();
    return res.status(204).end();
  }
  next();
});
app.use(express.json({ limit: '100kb', strict: true, verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(createSessionMiddleware());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, service: 'promiden-api', status: 'ok' });
  } catch (error) {
  console.error('Health check database error:', error.message);

  res.status(503).json({
    success: false,
    service: 'promiden-api',
    status: 'session-store-unavailable'
  });
}
});
app.use('/api/public', publicRoutes);
app.use('/api', paymentRoutes);
app.use('/api/admin', adminRoutes);

// The dashboard document is served only after checking the server-side session.
app.get('/admin-page.html', (req, res) => {
  if (!req.session?.admin) return res.redirect(302, '/admin-login.html');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(FRONTEND_DIR, 'admin-page.html'));
});
app.use(express.static(FRONTEND_DIR, {
  index: 'index.html',
  etag: true,
  maxAge: isProduction ? '1h' : 0,
  setHeaders(res, filePath) {
    if (path.basename(filePath) === 'admin-page.html') res.setHeader('Cache-Control', 'no-store');
  }
}));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  res.status(404).sendFile(path.join(FRONTEND_DIR, 'index.html'));
});
app.use((error, _req, res, _next) => {
  console.error('Unhandled request error:', error.message);
  if (res.headersSent) return;
  const status = error.status === 413 ? 413 : (error.status === 400 ? 400 : 500);
  const message = status === 413 ? 'Request body is too large.' : status === 400 ? 'Request body is invalid.' : 'An unexpected server error occurred.';
  res.status(status).json({ success: false, message });
});

const server = app.listen(PORT, () => {
  console.log(`Promiden API and website running on http://localhost:${PORT}`);
  console.log(`Frontend directory: ${FRONTEND_DIR}`);
});
async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully.`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
