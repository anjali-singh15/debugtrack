/**
 * Google Sign-In: verifies ID tokens issued by Google Identity Services.
 * Enabled only when GOOGLE_CLIENT_ID is set (an OAuth 2.0 "Web application" client id).
 */
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

function isConfigured() {
  return !!CLIENT_ID;
}

/**
 * Checks the token's signature, expiry, issuer and audience.
 * Resolves to { googleId, email, emailVerified, name }, or null when the token is not valid.
 */
async function verifyIdToken(idToken) {
  if (!client) return null;
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return null;
  }
  if (!payload || !payload.sub || !payload.email) return null;
  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name || ''
  };
}

module.exports = { CLIENT_ID, isConfigured, verifyIdToken };
