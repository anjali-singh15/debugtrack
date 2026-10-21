/**
 * DebugTrack - Express REST API server.
 *
 * Also serves the AngularJS frontend (index.html, css/, js/, pages/) so the whole app
 * can run from http://localhost:3000. The backend folder itself (database, secrets)
 * is never served.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ready, get, dbPath } = require('./database');
const { requireAuth } = require('./middleware/auth');
const { HttpError } = require('./utils/http');
const { ExecutionServiceError } = require('./judgeService');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.join(__dirname, '..');

const app = express();
app.disable('x-powered-by');
// Behind a hosting proxy (e.g. Render) the client IP comes from X-Forwarded-For; rate limits use it.
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ------------------------------------------------------------------ API
app.get('/api/health', async (req, res) => {
  const row = await get('SELECT COUNT(*) AS n FROM problems');
  res.json({ status: 'ok', database: 'connected', problems: row.n });
});

app.use('/api/auth', require('./routes/auth'));

// Everything below requires a valid JWT
const privateApi = express.Router();
privateApi.use(requireAuth);
privateApi.use('/problems', require('./routes/problems'));
privateApi.use('/submissions', require('./routes/submissions'));
privateApi.use(require('./routes/execution'));
privateApi.use(require('./routes/insights'));
privateApi.use(require('./routes/profile'));
app.use('/api', privateApi);

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// ------------------------------------------------------------------ Frontend (static)
['css', 'js', 'pages', 'lib', 'assets'].forEach((dir) => {
  app.use(`/${dir}`, express.static(path.join(FRONTEND_DIR, dir), { dotfiles: 'deny' }));
});
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// ------------------------------------------------------------------ Errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.details });
  }
  if (err instanceof ExecutionServiceError) {
    return res.status(err.httpStatus).json({ error: err.message, code: 'EXECUTION_SERVICE' });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

async function start(port = PORT) {
  await ready;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`DebugTrack server running on http://localhost:${server.address().port}`);
      console.log(`SQLite database: ${dbPath}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
