const { randomUUID } = require('node:crypto');
function text(value, max, field, { required = false } = {}) {
  if (typeof value !== 'string') {
    if (required) throw new Error(`${field} is required.`);
    return '';
  }
  const result = value.trim();
  if (required && !result) throw new Error(`${field} is required.`);
  if (result.length > max) throw new Error(`${field} must be ${max} characters or fewer.`);
  return result;
}
function optionalUrl(value, field) {
  const result = text(value, 2000, field);
  if (!result) return '';
  let parsed;
  try { parsed = new URL(result); } catch { throw new Error(`${field} must be a valid URL.`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${field} must use HTTP or HTTPS.`);
  return result;
}
function idOrNew(value) { return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : randomUUID(); }
function respondError(res, error) {
  const message = error && error.message ? error.message : 'Request could not be completed.';
  const status = /required|characters|valid URL|must use/i.test(message) ? 400 : 500;
  if (status === 500) console.error('API error:', message);
  return res.status(status).json({ success: false, message: status === 400 ? message : 'The server could not complete this request.' });
}
module.exports = { text, optionalUrl, idOrNew, respondError };
