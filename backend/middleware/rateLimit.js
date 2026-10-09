/**
 * Minimal in-memory fixed-window rate limiter (sufficient for a single-process deployment).
 * Keyed by the logged-in user when available, otherwise by client IP.
 */
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return function (req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === '1') return next();
    const key = req.user ? `u:${req.user.id}` : `ip:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message || 'Too many requests. Please slow down and try again shortly.' });
    }
    next();
  };
}

module.exports = { rateLimit };
