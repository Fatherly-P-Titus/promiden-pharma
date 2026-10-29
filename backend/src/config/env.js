const required = ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'];
function validateEnv() {
  const missing = required.filter((key) => !process.env[key] || process.env[key].startsWith('YOUR_') || process.env[key].includes('replace-with'));
  if (missing.length) {
    throw new Error(`Missing required environment configuration: ${missing.join(', ')}. Copy backend/.env.example to backend/.env and configure it.`);
  }
  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  if (!/^https:\/\//i.test(process.env.SUPABASE_URL) && process.env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_URL must use HTTPS in production.');
  }
}
module.exports = { validateEnv };
