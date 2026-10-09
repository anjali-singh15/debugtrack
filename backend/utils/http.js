/**
 * Shared HTTP helpers: a typed client error and small validation utilities.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CODE_LENGTH = 50000;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 72) return 'Password must be at most 72 characters long.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

/** Public representation of a user row: never includes passwordHash. */
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || 'Student',
    university: u.university || '',
    avatarInitials: initials(u.name),
    firstName: String(u.name || '').split(/\s+/)[0],
    createdAt: u.createdAt || null
  };
}

module.exports = { HttpError, EMAIL_RE, MAX_CODE_LENGTH, str, validatePassword, publicUser, initials };
