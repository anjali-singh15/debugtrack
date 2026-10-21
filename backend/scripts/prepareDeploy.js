/**
 * Runs before the server on hosts whose disk is wiped on restart (e.g. Render's free plan).
 * When no database exists yet, it starts from data/demo-snapshot.db: the 41 problems, the demo
 * account (demo@debugtrack.dev / Demo@1234) and its submission history. An existing database is
 * never touched.
 */
const fs = require('fs');
const path = require('path');

const target = process.env.DB_PATH || path.join(__dirname, '..', 'debugtrack.db');
const snapshot = path.join(__dirname, '..', 'data', 'demo-snapshot.db');

if (fs.existsSync(target)) {
  console.log(`Using existing database: ${target}`);
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(snapshot, target);
  console.log(`Created ${target} from the demo snapshot.`);
}
