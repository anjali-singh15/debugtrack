/**
 * Tests for the bulk problem import (services/problemImportService.js, scripts/importProblems.js).
 * They use a throw-away database and a mocked Judge0, so they need no network access.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debugtrack-import-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');

const { seed } = require('../seed');
const { all, get } = require('../database');
const { loadProblems } = require('../services/problemService');
const { parseJavaCall } = require('../data/signatures');
const {
  parseImportFile, normalizeProblem, validateImport, verifyProblem, insertProblems, isServiceError, buildJavaCall
} = require('../services/problemImportService');

const SAMPLE_PATH = path.join(__dirname, '..', 'data', 'import-sample.json');
const sample = () => JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf8')).problems;
const SCRIPT = path.join(__dirname, '..', 'scripts', 'importProblems.js');
const runCli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env }, encoding: 'utf8' });

const snapshot = () => all('SELECT * FROM problems ORDER BY id');
let original;

test.before(async () => {
  await seed({ reset: true });
  original = await snapshot();
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ parsing

test('malformed JSON is rejected with a clear message', () => {
  const r = parseImportFile('{ "problems": [ { "id": "x", } ]');
  assert.match(r.error, /^Malformed JSON/);
  assert.match(parseImportFile('{"foo": 1}').error, /JSON array of problems/);
  assert.match(parseImportFile('[]').error, /no problems/);
  const ok = parseImportFile(fs.readFileSync(SAMPLE_PATH, 'utf8'));
  assert.equal(ok.problems.length, 4);
  assert.ok(ok.source.license);
});

// ------------------------------------------------------------------ validation

test('missing required fields are reported with reasons', () => {
  const { problem, errors } = normalizeProblem({ id: 'no-fields' });
  assert.equal(problem, null);
  for (const field of ['title', 'description', 'referenceSolution', 'difficulty', 'topic', 'signature', 'tests']) {
    assert.ok(errors.some((e) => e.includes(`"${field}"`)), `expected an error about ${field}: ${errors.join(' | ')}`);
  }
});

test('wrong value types, bad ids, unknown topics and unsupported types are rejected', () => {
  const base = sample()[0];
  const bad = (patch) => normalizeProblem({ ...base, ...patch }).errors;
  assert.ok(bad({ id: 'Bad Id!' }).some((e) => e.includes('"id"')));
  assert.ok(bad({ topic: 'Rocket Science' }).some((e) => e.includes('"topic"')));
  assert.ok(bad({ difficulty: 'Extreme' }).some((e) => e.includes('"difficulty"')));
  assert.ok(bad({ focus: ['Typos'] }).some((e) => e.includes('unknown categories')));
  assert.ok(bad({ signature: { method: 'f', params: [['x', 'double']], returns: 'int' } }).some((e) => e.includes('unsupported type "double"')));
  assert.ok(bad({ tests: [{ args: ['not an array'], expected: 1 }] }).some((e) => e.includes('tests[0].args[0] (nums)')));
  assert.ok(bad({ tests: [{ args: [[1, 2]], expected: 'two' }] }).some((e) => e.includes('tests[0].expected')));
  assert.ok(bad({ tests: [{ args: [[1, 2]], expected: 1, hidden: true }] }).some((e) => e.includes('At least one test must be visible')));
  assert.ok(bad({ referenceSolution: 'class Solution {}' }).some((e) => e.includes('declares secondLargest')));
});

test('a valid problem is normalised into the stored format with generated Java calls and starter', () => {
  const { problem, errors } = normalizeProblem(sample()[2]); // reverse-subarray (void, in place)
  assert.deepEqual(errors, []);
  assert.match(problem.starterCode, /public void reverseRange\(int\[\] nums, int left, int right\)/);
  const t0 = problem.tests[0];
  assert.equal(t0.call, '{ int[] a = {1, 2, 3, 4, 5}; sol.reverseRange(a, 1, 3); DT.out(a); }');
  assert.equal(t0.input, 'nums = [1, 2, 3, 4, 5], left = 1, right = 3');
  assert.equal(t0.expected, '[1, 4, 3, 2, 5]');
  assert.deepEqual(t0.args, [[1, 2, 3, 4, 5], 1, 3]);
  assert.equal(problem.tests[2].hidden, true);
  assert.equal(problem.tests[1].edge, 'single element');
  assert.equal(problem.examples.length, 2); // defaults to the visible tests
});

test('generated Java calls round-trip through the harness parser for every parameter type', () => {
  const cases = [
    [{ method: 'f', params: [['s', 'String']], returns: 'String' }, ['a, "b" (c)'], 'DT.outStr('],
    [{ method: 'f', params: [['g', 'char[][]']], returns: 'int' }, [['10', '01']], 'DT.grid("10", "01")'],
    [{ method: 'f', params: [['r', 'TreeNode']], returns: 'boolean' }, [[3, 9, null, 7]], 'DT.tree(3, 9, null, 7)'],
    [{ method: 'f', params: [['m', 'int[][]']], returns: 'int[][]' }, [[[1, 2], [3]]], 'new int[][]{{1, 2}, {3}}'],
    [{ method: 'f', params: [['w', 'String[]']], returns: 'int' }, [['x', 'y,z']], 'new String[]{"x", "y,z"}'],
    [{ method: 'f', params: [['h', 'ListNode'], ['k', 'int']], returns: 'ListNode' }, [[], -4], 'DT.outList(sol.f(DT.list(), -4))']
  ];
  for (const [sig, args, fragment] of cases) {
    const call = buildJavaCall(sig, args);
    assert.ok(call.includes(fragment), `${call} should contain ${fragment}`);
    assert.deepEqual(parseJavaCall(call, sig), args);
  }
});

test('duplicates are detected by id and title against the database and within the file', async () => {
  const [first] = sample();
  const report = await validateImport([
    { ...first, id: 'two-sum' }, // id already in the curated bank
    { ...first, id: 'two-sum-copy', title: '  two   SUM ' }, // same title, different case/spacing
    first,
    { ...first, id: 'second-largest-again' }, // same title earlier in this file
    { ...first, id: 'second-largest' } // same id earlier in this file
  ]);
  assert.deepEqual(report.valid.map((p) => p.id), ['second-largest']);
  assert.equal(report.duplicates.length, 4);
  assert.match(report.duplicates[0].reason, /id "two-sum" already in the database/);
  assert.match(report.duplicates[1].reason, /already in the database as "two-sum"/);
  assert.match(report.duplicates[2].reason, /appears earlier in this file/);
  assert.match(report.duplicates[3].reason, /appears earlier in this file/);
});

test('invalid problems are reported separately and do not block valid ones', async () => {
  const report = await validateImport([{ id: 'broken', title: 'Broken' }, ...sample().slice(0, 1), 'not an object']);
  assert.equal(report.valid.length, 1);
  assert.equal(report.invalid.length, 2);
  assert.equal(report.invalid[0].id, 'broken');
  assert.ok(report.invalid[0].errors.length > 3);
});

// ------------------------------------------------------------------ insertion

test('a failing insert rolls back the whole batch and never overwrites existing problems', async () => {
  const [a] = (await validateImport(sample())).valid;
  const clash = { ...a, id: 'two-sum', title: 'Overwrite attempt' }; // bypasses validation on purpose
  await assert.rejects(() => insertProblems([a, clash]), /UNIQUE|constraint/i);
  assert.equal(await get('SELECT id FROM problems WHERE id = ?', [a.id]), undefined, 'first problem of the batch must be rolled back');
  assert.deepEqual(await snapshot(), original, 'existing problems must be untouched');
});

test('valid problems are inserted after the existing ones and appear in the catalogue', async () => {
  const report = await validateImport(sample());
  assert.equal(report.valid.length, 4);
  const ids = await insertProblems(report.valid);
  assert.deepEqual(ids, ['second-largest', 'is-subsequence', 'reverse-subarray', 'remove-list-value']);

  const rows = await all('SELECT id, number, testCases FROM problems WHERE id IN (?, ?, ?, ?) ORDER BY number', ids);
  const maxOriginal = Math.max(...original.map((r) => r.number));
  assert.deepEqual(rows.map((r) => r.number), [maxOriginal + 1, maxOriginal + 2, maxOriginal + 3, maxOriginal + 4]);
  const tests = JSON.parse(rows[0].testCases);
  assert.ok(tests.every((t) => t.call && Array.isArray(t.args) && typeof t.hidden === 'boolean' && t.id));

  const catalogue = await loadProblems(); // cache was invalidated by the import
  const imported = catalogue.find((p) => p.id === 'remove-list-value');
  assert.ok(imported);
  assert.match(imported.starterCodes.python, /def removeElements\(self, head: Optional\[ListNode\], val: int\)/);
  assert.match(imported.starterCodes.cpp, /ListNode\* removeElements\(ListNode\* head, int val\)/);

  // Existing rows are byte-for-byte unchanged
  const now = (await snapshot()).filter((r) => !ids.includes(r.id));
  assert.deepEqual(now, original);

  // Importing the same file again: everything is a duplicate
  const again = await validateImport(sample());
  assert.equal(again.valid.length, 0);
  assert.equal(again.duplicates.length, 4);
});

// ------------------------------------------------------------------ verification (mocked Judge0)

test('verification passes only when the reference is Accepted and every starter compiles', async () => {
  const [p] = (await validateImport([{ ...sample()[0], id: 'verify-me', title: 'Verify Me' }])).valid;
  const calls = [];
  const execute = async (code, problem, opts) => {
    calls.push(opts.language + (opts.includeHidden ? '+hidden' : ''));
    return { verdict: code === problem.referenceSolution ? 'Accepted' : 'Wrong Answer', testsPassed: 0, testsTotal: 2, tests: [] };
  };
  const ok = await verifyProblem(p, { execute, delayMs: 0 });
  assert.deepEqual(ok, { ok: true, failures: [] });
  assert.deepEqual(calls, ['java+hidden', 'java', 'python', 'cpp']);

  const wrongRef = await verifyProblem(p, {
    delayMs: 0,
    execute: async (code, problem) => (code === problem.referenceSolution
      ? { verdict: 'Wrong Answer', testsPassed: 4, testsTotal: 5, tests: [{ id: 3, passed: false, input: 'nums = [7, 7, 7]', expected: '-1', actual: '7' }] }
      : { verdict: 'Wrong Answer', tests: [] })
  });
  assert.equal(wrongRef.ok, false);
  assert.match(wrongRef.failures[0], /reference solution: Wrong Answer \(4\/5 tests\)/);
  assert.match(wrongRef.failures[1], /expected -1, got 7/);

  const badStarter = await verifyProblem(p, {
    delayMs: 0,
    execute: async (code, problem, opts) => (opts.language === 'cpp' ? { verdict: 'Compilation Error', compileOutput: 'error: x' } : { verdict: code === problem.referenceSolution ? 'Accepted' : 'Wrong Answer' })
  });
  assert.equal(badStarter.ok, false);
  assert.match(badStarter.failures[0], /cpp starter does not compile/);
});

test('Judge0 being unreachable is recognised as a service error, not a bad problem', () => {
  const svc = new Error('The code execution service is unavailable.');
  svc.name = 'ExecutionServiceError';
  assert.equal(isServiceError(svc), true);
  const net = new TypeError('fetch failed');
  net.cause = { code: 'ENOTFOUND' };
  assert.equal(isServiceError(net), true);
  assert.equal(isServiceError(new TypeError('Cannot read properties of undefined')), false);
});

// ------------------------------------------------------------------ CLI

test('CLI: dry run previews without writing, malformed files abort cleanly', async () => {
  const before = await snapshot();
  const fresh = path.join(tmpDir, 'fresh.json');
  fs.writeFileSync(fresh, JSON.stringify({ problems: [{ ...sample()[0], id: 'cli-dry', title: 'CLI Dry Run' }, { id: 'cli-broken' }] }));

  const dry = runCli(fresh, '--dry-run');
  assert.equal(dry.status, 1, 'invalid problems make the exit code non-zero');
  assert.match(dry.stdout, /✓ cli-dry/);
  assert.match(dry.stdout, /✗ cli-broken/);
  assert.match(dry.stdout, /Dry run: 1 would be imported, 0 duplicate\(s\), 1 invalid\. Nothing was written\./);
  assert.match(dry.stdout, /no "source.license"/);

  const malformed = path.join(tmpDir, 'bad.json');
  fs.writeFileSync(malformed, '{ not json');
  const bad = runCli(malformed);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Malformed JSON/);
  assert.match(bad.stderr, /Nothing was written/);

  assert.equal(runCli(path.join(tmpDir, 'missing.json')).status, 1);
  assert.deepEqual(await snapshot(), before);
});

test('CLI: --skip-verify imports valid problems and labels them unverified', async () => {
  const file = path.join(tmpDir, 'offline.json');
  fs.writeFileSync(file, JSON.stringify([{ ...sample()[1], id: 'cli-offline', title: 'CLI Offline Import' }]));
  const r = runCli(file, '--skip-verify');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Imported: +1 \(UNVERIFIED\)/);
  assert.ok(await get('SELECT id FROM problems WHERE id = ?', ['cli-offline']));
});
