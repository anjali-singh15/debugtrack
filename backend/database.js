/**
 * DebugTrack - SQLite connection, schema and promise helpers.
 *
 * Analytics are NOT stored: every statistic is derived from the submissions table
 * at request time, so dashboards can never drift out of sync with real attempts.
 */
const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'debugtrack.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Student',
    university TEXT,
    settings TEXT,
    googleId TEXT,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    number INTEGER,
    title TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    topic TEXT NOT NULL,
    focus TEXT,
    signature TEXT,
    mistakeProneArea TEXT,
    description TEXT,
    examples TEXT,
    constraints TEXT,
    hints TEXT,
    starterCode TEXT,
    testCases TEXT,
    referenceSolution TEXT
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problemId TEXT NOT NULL REFERENCES problems(id),
    code TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'java',
    status TEXT NOT NULL,
    runtime TEXT,
    memory TEXT,
    runtimeMs INTEGER,
    memoryKb INTEGER,
    testCasesPassed INTEGER DEFAULT 0,
    totalTestCases INTEGER DEFAULT 0,
    testResults TEXT,
    mistakeCategory TEXT,
    mistakeConfidence TEXT,
    ruleMatched TEXT,
    feedback TEXT,
    suggestion TEXT,
    evidence TEXT,
    practiceTopic TEXT,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_user_time ON submissions(userId, timestamp);
  CREATE INDEX IF NOT EXISTS idx_submissions_user_problem ON submissions(userId, problemId);
`;

// Columns added after Review 1. Older database files get them via ALTER TABLE.
const ADDITIVE_COLUMNS = {
  users: { passwordHash: 'TEXT', role: "TEXT DEFAULT 'Student'", university: 'TEXT', settings: 'TEXT', createdAt: 'TEXT', googleId: 'TEXT' },
  problems: { number: 'INTEGER', focus: 'TEXT', signature: 'TEXT', mistakeProneArea: 'TEXT', referenceSolution: 'TEXT' },
  submissions: {
    runtimeMs: 'INTEGER', memoryKb: 'INTEGER', mistakeConfidence: 'TEXT',
    evidence: 'TEXT', practiceTopic: 'TEXT'
  }
};

async function ensureColumns() {
  for (const [table, columns] of Object.entries(ADDITIVE_COLUMNS)) {
    const existing = (await all(`PRAGMA table_info(${table})`)).map((c) => c.name);
    for (const [name, type] of Object.entries(columns)) {
      if (!existing.includes(name)) {
        await run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
        // Review-1 databases kept the bcrypt hash in a column called "password"
        if (table === 'users' && name === 'passwordHash' && existing.includes('password')) {
          await run('UPDATE users SET passwordHash = password WHERE passwordHash IS NULL');
        }
      }
    }
  }
  // The Review-1 "analytics" table held static mock statistics; analytics are now derived.
  await run('DROP TABLE IF EXISTS analytics');
}

async function initSchema() {
  await exec(SCHEMA);
  await ensureColumns();
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(googleId) WHERE googleId IS NOT NULL');
}

const ready = (async () => {
  await initSchema();
  await exec('PRAGMA journal_mode = WAL;');
})();

module.exports = { db, run, get, all, exec, ready, initSchema, dbPath };
