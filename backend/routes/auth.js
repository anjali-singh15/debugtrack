const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../database');
const { signToken, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { HttpError, EMAIL_RE, str, validatePassword, publicUser } = require('../utils/http');
const { DEFAULT_SETTINGS } = require('./profile');
const googleAuth = require('../services/googleAuthService');

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

// GET /api/auth/config - public settings the login page needs
router.get('/config', (req, res) => {
  res.json({ googleClientId: googleAuth.isConfigured() ? googleAuth.CLIENT_ID : null });
});

// POST /api/auth/google - exchange a Google ID token for a DebugTrack session
router.post('/google', authLimiter, async (req, res) => {
  if (!googleAuth.isConfigured()) {
    throw new HttpError(503, 'Google sign-in is not enabled on this server.');
  }
  const credential = str(req.body && req.body.credential);
  if (!credential) {
    throw new HttpError(400, 'Google credential is required.');
  }
  const profile = await googleAuth.verifyIdToken(credential);
  if (!profile) {
    throw new HttpError(401, 'Google sign-in failed. Please try again.');
  }
  if (!profile.emailVerified) {
    throw new HttpError(401, 'Your Google account email is not verified.');
  }

  let user = await get('SELECT * FROM users WHERE googleId = ?', [profile.googleId]);
  let created = false;
  if (!user) {
    const existing = await get('SELECT * FROM users WHERE email = ?', [profile.email]);
    let userId;
    if (existing) {
      if (existing.googleId) {
        throw new HttpError(409, 'This email is already linked to a different Google account.');
      }
      // Google has verified the address, so link it to the existing email/password account
      await run('UPDATE users SET googleId = ? WHERE id = ?', [profile.googleId, existing.id]);
      userId = existing.id;
    } else {
      const name = (profile.name || profile.email.split('@')[0]).slice(0, 60);
      // Google-only accounts have no password; an empty hash never matches in /login
      const { lastID } = await run(
        'INSERT INTO users (name, email, passwordHash, role, settings, googleId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, profile.email, '', 'Student', JSON.stringify(DEFAULT_SETTINGS), profile.googleId, new Date().toISOString()]
      );
      created = true;
      userId = lastID;
    }
    user = await get('SELECT * FROM users WHERE id = ?', [userId]);
  }
  res.status(created ? 201 : 200).json({ token: signToken(user), user: publicUser(user), created });
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
