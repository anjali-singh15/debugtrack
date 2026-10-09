const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../database');
const { signToken, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { HttpError, EMAIL_RE, str, validatePassword, publicUser } = require('../utils/http');
const { DEFAULT_SETTINGS } = require('./profile');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts. Please wait a few minutes and try again.' });

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const name = str(req.body && req.body.name);
  const email = str(req.body && req.body.email).toLowerCase();
  const password = req.body && req.body.password;
  const confirmPassword = req.body && req.body.confirmPassword;

  const fieldErrors = {};
  if (!name) fieldErrors.name = 'Name is required.';
  else if (name.length < 2 || name.length > 60) fieldErrors.name = 'Name must be between 2 and 60 characters.';
  if (!email) fieldErrors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email) || email.length > 120) fieldErrors.email = 'Please enter a valid email address.';
  if (!password) fieldErrors.password = 'Password is required.';
  else {
    const pwError = validatePassword(password);
    if (pwError) fieldErrors.password = pwError;
  }
  if (!confirmPassword) fieldErrors.confirmPassword = 'Please confirm your password.';
  else if (password !== confirmPassword) fieldErrors.confirmPassword = 'Passwords do not match.';
  if (Object.keys(fieldErrors).length) {
    throw new HttpError(400, Object.values(fieldErrors)[0], fieldErrors);
  }

  const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists. Try logging in instead.', { email: 'This email is already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { lastID } = await run(
    'INSERT INTO users (name, email, passwordHash, role, settings, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, 'Student', JSON.stringify(DEFAULT_SETTINGS), new Date().toISOString()]
  );
  const user = await get('SELECT * FROM users WHERE id = ?', [lastID]);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const email = str(req.body && req.body.email).toLowerCase();
  const password = req.body && req.body.password;
  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }
  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, 'Please enter a valid email address.', { email: 'Please enter a valid email address.' });
  }
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  // Same message for unknown email and wrong password, so accounts cannot be enumerated
  const ok = user && user.passwordHash && typeof password === 'string' && await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout - tokens are stateless; the client discards its token.
router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
