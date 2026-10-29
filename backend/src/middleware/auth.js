function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin || !req.session.admin.id) {
    return res.status(401).json({ success: false, message: 'Administrator sign-in required.' });
  }
  next();
}
function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  const allowed = [process.env.APP_ORIGIN, process.env.FRONTEND_ORIGIN, `${req.protocol}://${req.get('host')}`].filter(Boolean).map(value => value.replace(/\/$/, ''));
  if (origin && !allowed.includes(origin.replace(/\/$/, ''))) {
    return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  }
  next();
}
module.exports = { requireAdmin, requireSameOrigin };
