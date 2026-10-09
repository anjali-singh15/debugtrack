/**
 * Seeds the problem catalogue and the demo account.
 *
 *   node seed.js           upsert problems + ensure demo account exists (keeps users & submissions)
 *   node seed.js --reset   drop and recreate all tables first (fresh database)
 *
 * Demo submissions are NOT inserted here: run `node scripts/seedDemo.js` to generate them by
 * executing real code on Judge0, so every demo statistic comes from genuine submissions.
 */
const bcrypt = require('bcryptjs');
const { ready, run, get, exec, initSchema } = require('./database');
const { PROBLEMS } = require('./data/problems');
const { DEFAULT_SETTINGS } = require('./routes/profile');

const DEMO_USER = {
  name: 'Anjali Singh',
  email: 'demo@debugtrack.dev',
  password: 'Demo@1234',
  university: 'MLR Institute of Technology'
};

async function seed({ reset = false } = {}) {
  await ready;
  if (reset) {
    console.log('Resetting database...');
    await exec('PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS submissions; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS problems; DROP TABLE IF EXISTS analytics; PRAGMA foreign_keys = ON;');
    await initSchema();
  }

  for (const p of PROBLEMS) {
    await run(
      `INSERT INTO problems (id, number, title, difficulty, topic, focus, signature, mistakeProneArea, description, examples, constraints, hints, starterCode, testCases, referenceSolution)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET number = excluded.number, title = excluded.title, difficulty = excluded.difficulty,
         topic = excluded.topic, focus = excluded.focus, signature = excluded.signature, mistakeProneArea = excluded.mistakeProneArea,
         description = excluded.description, examples = excluded.examples, constraints = excluded.constraints,
         hints = excluded.hints, starterCode = excluded.starterCode, testCases = excluded.testCases,
         referenceSolution = excluded.referenceSolution`,
      [p.id, p.number, p.title, p.difficulty, p.topic, JSON.stringify(p.focus), JSON.stringify(p.signature), p.mistakeProneArea, p.description,
        JSON.stringify(p.examples), JSON.stringify(p.constraints), JSON.stringify(p.hints), p.starterCode,
        JSON.stringify(p.tests), p.referenceSolution]
    );
  }
  console.log(`Upserted ${PROBLEMS.length} problems.`);

  const existing = await get('SELECT id FROM users WHERE email = ?', [DEMO_USER.email]);
  if (!existing) {
    await run(
      'INSERT INTO users (name, email, passwordHash, role, university, settings, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [DEMO_USER.name, DEMO_USER.email, bcrypt.hashSync(DEMO_USER.password, 10), 'Student', DEMO_USER.university,
        JSON.stringify(DEFAULT_SETTINGS), new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()]
    );
    console.log(`Created demo account ${DEMO_USER.email} / ${DEMO_USER.password}`);
  } else {
    console.log(`Demo account ${DEMO_USER.email} already exists.`);
  }
}

if (require.main === module) {
  seed({ reset: process.argv.includes('--reset') })
    .then(() => { console.log('Seed complete.'); process.exit(0); })
    .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
}

module.exports = { seed, DEMO_USER };
