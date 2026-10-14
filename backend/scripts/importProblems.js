/**
 * Bulk-imports coding problems from a JSON file (format: README "Bulk Problem Import",
 * sample: data/import-sample.json).
 *
 *   node scripts/importProblems.js <file.json> --dry-run      validate + preview, writes nothing
 *   node scripts/importProblems.js <file.json>                validate, verify on Judge0, insert
 *   node scripts/importProblems.js <file.json> --skip-verify  insert WITHOUT Judge0 (offline only)
 *
 * Command-line only on purpose: DebugTrack has no admin role, so an HTTP import endpoint would
 * be open to every student. Running this script requires shell access to the server.
 *
 * Exit code: 0 when every problem was imported (or would be, in a dry run), 1 otherwise.
 */
const fs = require('fs');
const path = require('path');
const { ready } = require('../database');
const { parseImportFile, validateImport, verifyProblem, insertProblems, isServiceError } = require('../services/problemImportService');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipVerify = args.includes('--skip-verify');
const file = args.find((a) => !a.startsWith('--'));

function fail(message) {
  console.error(`\nImport aborted: ${message}\nNothing was written to the database.`);
  process.exit(1);
}

function printReport(report) {
  if (report.invalid.length) {
    console.log(`\nINVALID (${report.invalid.length}) - not imported:`);
    report.invalid.forEach((p) => {
      console.log(`  ✗ ${p.id}`);
      p.errors.forEach((e) => console.log(`      - ${e}`));
    });
  }
  if (report.duplicates.length) {
    console.log(`\nDUPLICATES (${report.duplicates.length}) - skipped, existing problems left unchanged:`);
    report.duplicates.forEach((p) => console.log(`  = ${p.id}: ${p.reason}`));
  }
  if (report.warnings.length) {
    console.log('\nWARNINGS (problem is still valid):');
    report.warnings.forEach((w) => w.warnings.forEach((m) => console.log(`  ! ${w.id}: ${m}`)));
  }
  console.log(`\nVALID (${report.valid.length}):`);
  report.valid.forEach((p) => {
    const hidden = p.tests.filter((t) => t.hidden).length;
    console.log(`  ✓ ${p.id.padEnd(28)} ${p.difficulty.padEnd(7)} ${p.topic.padEnd(20)} ${p.tests.length} tests (${hidden} hidden)`);
  });
}

(async () => {
  if (!file) fail('usage: npm run import:problems -- <file.json> [--dry-run] [--skip-verify]');
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) fail(`file not found: ${filePath}`);
  if (fs.statSync(filePath).size > MAX_FILE_BYTES) fail('file is larger than 5 MB.');

  const parsed = parseImportFile(fs.readFileSync(filePath, 'utf8'));
  if (parsed.error) fail(parsed.error);

  console.log(`Import file: ${filePath} (${parsed.problems.length} problem(s))${dryRun ? '  [DRY RUN]' : ''}`);
  if (parsed.source && parsed.source.license) {
    console.log(`Source: ${parsed.source.name || 'unnamed'} · licence: ${parsed.source.license}${parsed.source.url ? ` · ${parsed.source.url}` : ''}`);
  } else {
    console.log('Note: no "source.license" in the file. Make sure you are allowed to use these problems and give any required attribution.');
  }

  await ready;
  const report = await validateImport(parsed.problems);
  printReport(report);

  if (dryRun) {
    console.log(`\nDry run: ${report.valid.length} would be imported, ${report.duplicates.length} duplicate(s), ${report.invalid.length} invalid. Nothing was written.`);
    if (!skipVerify && report.valid.length) console.log('A real import also verifies every problem on Judge0 before inserting it.');
    process.exit(report.invalid.length || report.duplicates.length ? 1 : 0);
  }
  if (!report.valid.length) fail('no valid new problems to import.');

  let toInsert = report.valid;
  const failedVerification = [];
  if (skipVerify) {
    console.log('\n--skip-verify: problems are inserted UNVERIFIED. Run a real import (or test each problem) once Judge0 is reachable.');
  } else {
    console.log('\nVerifying on Judge0 (reference solution on all tests + starter code in every language)...');
    toInsert = [];
    for (const p of report.valid) {
      let result;
      try {
        result = await verifyProblem(p);
      } catch (err) {
        if (isServiceError(err)) fail(`Judge0 is unavailable. ${err.message} (JUDGE0_URL can point to another instance; --skip-verify imports without verification.)`);
        throw err;
      }
      if (result.ok) {
        console.log(`  PASS  ${p.id}`);
        toInsert.push(p);
      } else {
        console.log(`  FAIL  ${p.id}`);
        result.failures.forEach((f) => console.log(`        ${f}`));
        failedVerification.push(p.id);
      }
    }
  }

  let inserted = [];
  if (toInsert.length) {
    try {
      inserted = await insertProblems(toInsert);
    } catch (err) {
      fail(`database error, the transaction was rolled back (${err.message}).`);
    }
  }

  console.log('\n----------------------------------------');
  console.log(`Imported:             ${inserted.length}${skipVerify && inserted.length ? ' (UNVERIFIED)' : ''}`);
  console.log(`Skipped (duplicates): ${report.duplicates.length}`);
  console.log(`Invalid:              ${report.invalid.length}`);
  if (!skipVerify) console.log(`Failed verification:  ${failedVerification.length}`);
  if (inserted.length) console.log('\nRestart the server (npm start) so the new problems appear on the website.');
  const allImported = inserted.length === parsed.problems.length;
  process.exit(allImported ? 0 : 1);
})().catch((err) => {
  console.error('\nImport failed with an unexpected error:', err);
  process.exit(1);
});
