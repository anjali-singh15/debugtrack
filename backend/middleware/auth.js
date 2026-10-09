/**
 * JWT authentication middleware.
 * The signing secret comes from JWT_SECRET, or is generated once and stored in
 * backend/.jwt-secret so tokens survive server restarts during development.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { get } = require('../database');

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '12h';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(__dirname, '..', '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (e) {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = loadSecret();

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: TOKEN_TTL });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Please log in to continue.', code: 'NO_TOKEN' });
  }
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Your session has expired. Please log in again.' : 'Invalid session. Please log in again.',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
    });
  }
  // The account must still exist (e.g. not deleted since the token was issued)
  const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [payload.sub]);
  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please log in again.', code: 'TOKEN_INVALID' });
  }
  req.user = user;
  next();
}

module.exports = { signToken, requireAuth, SECRET };
