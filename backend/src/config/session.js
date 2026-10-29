const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
pool.on('error', (error) => console.error('Session database pool error:', error.message));

function createSessionMiddleware() {
  return session({
    name: process.env.SESSION_COOKIE_NAME || 'promiden.sid',
    store: new pgSession({ pool, tableName: 'promiden_sessions', createTableIfMissing: true, pruneSessionInterval: 15 * 60 }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.SESSION_SAME_SITE === 'none' ? 'none' : 'lax',
      maxAge: Number(process.env.SESSION_MAX_AGE_MS) || 8 * 60 * 60 * 1000,
      path: '/'
    }
  });
}
module.exports = { createSessionMiddleware, pool };
