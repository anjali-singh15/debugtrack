/**
 * API integration tests. Uses a throw-away SQLite database and a real server on a random port.
 * Code-execution tests call the real Judge0 CE service; set SKIP_JUDGE0=1 to skip them offline.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debugtrack-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.DISABLE_RATE_LIMIT = '1';

const jwt = require('jsonwebtoken');
const { seed } = require('../seed');
const { start } = require('../server');
const { SECRET } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const googleAuth = require('../services/googleAuthService');

const SKIP_JUDGE0 = process.env.SKIP_JUDGE0 === '1';
let server;
let base;

async function api(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, body: json, raw: text };
}

const alice = { name: 'Alice Tester', email: 'alice@example.com', password: 'secret123', confirmPassword: 'secret123' };
const bob = { name: 'Bob Tester', email: 'bob@example.com', password: 'secret456', confirmPassword: 'secret456' };
let aliceToken;
let bobToken;

test.before(async () => {
  await seed({ reset: true });
  server = await start(0);
  base = `http://localhost:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ AUTH
test('health check reports a connected database with seeded problems', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.database, 'connected');
  assert.ok(r.body.problems >= 30);
});

test('registration validates required fields, email, password length and confirmation', async () => {
  let r = await api('POST', '/api/auth/register', {});
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.name && r.body.fields.email && r.body.fields.password);

  r = await api('POST', '/api/auth/register', { ...alice, email: 'not-an-email' });
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.email);

  r = await api('POST', '/api/auth/register', { ...alice, password: 'abc1', confirmPassword: 'abc1' });
  assert.equal(r.status, 400);
  assert.match(r.body.fields.password, /at least 8/);

  r = await api('POST', '/api/auth/register', { ...alice, confirmPassword: 'different1' });
  assert.equal(r.status, 400);
  assert.match(r.body.fields.confirmPassword, /do not match/);
});

test('registration succeeds, returns a JWT and never exposes the password hash', async () => {
  const r = await api('POST', '/api/auth/register', alice);
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(r.body.user.email, alice.email);
  assert.ok(!/passwordHash|\$2[aby]\$/.test(r.raw), 'password hash leaked');
  aliceToken = r.body.token;

  const b = await api('POST', '/api/auth/register', bob);
  assert.equal(b.status, 201);
  bobToken = b.body.token;
});

test('duplicate email registration is rejected (case-insensitive)', async () => {
  const r = await api('POST', '/api/auth/register', { ...alice, email: 'ALICE@example.com' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /already exists/);
});

test('login rejects wrong credentials with a generic message and accepts valid ones', async () => {
  let r = await api('POST', '/api/auth/login', { email: alice.email, password: 'wrongpass1' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Invalid email or password.');
  r = await api('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'whatever1' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Invalid email or password.');
  r = await api('POST', '/api/auth/login', { email: alice.email });
  assert.equal(r.status, 400);

  r = await api('POST', '/api/auth/login', { email: alice.email, password: alice.password });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.ok(!r.raw.includes('passwordHash'));
});

test('demo account can log in', async () => {
  const r = await api('POST', '/api/auth/login', { email: 'demo@debugtrack.dev', password: 'Demo@1234' });
  assert.equal(r.status, 200);
});

test('protected APIs reject missing, invalid and expired tokens', async () => {
  for (const url of ['/api/problems', '/api/dashboard', '/api/analytics', '/api/mistakes', '/api/submissions', '/api/profile', '/api/data']) {
    const r = await api('GET', url);
    assert.equal(r.status, 401, url);
  }
  let r = await api('GET', '/api/auth/me', undefined, 'garbage.token.value');
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'TOKEN_INVALID');

  const forged = jwt.sign({ sub: 1 }, 'not-the-real-secret');
  r = await api('GET', '/api/dashboard', undefined, forged);
  assert.equal(r.status, 401);

  const expired = jwt.sign({ sub: 1 }, SECRET, { expiresIn: -10 });
  r = await api('GET', '/api/dashboard', undefined, expired);
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'TOKEN_EXPIRED');

  r = await api('GET', '/api/auth/me', undefined, aliceToken);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, alice.email);
});

// ------------------------------------------------------------------ PROBLEMS
// ------------------------------------------------------------------ GOOGLE SIGN-IN
// Token verification is stubbed: the real check needs Google's signing keys and a live client id.
function stubGoogle(profiles) {
  const original = { isConfigured: googleAuth.isConfigured, verifyIdToken: googleAuth.verifyIdToken, CLIENT_ID: googleAuth.CLIENT_ID };
  googleAuth.isConfigured = () => true;
  googleAuth.CLIENT_ID = 'test-client.apps.googleusercontent.com';
  googleAuth.verifyIdToken = async (token) => profiles[token] || null;
  return () => Object.assign(googleAuth, original);
}

test('Google sign-in is disabled without GOOGLE_CLIENT_ID', async () => {
  let r = await api('GET', '/api/auth/config');
  assert.equal(r.status, 200);
  assert.equal(r.body.googleClientId, null);
  r = await api('POST', '/api/auth/google', { credential: 'anything' });
  assert.equal(r.status, 503);
});

test('Google sign-in creates, reuses and links accounts', async (t) => {
  const restore = stubGoogle({
    carol: { googleId: 'g-carol', email: 'carol@example.com', emailVerified: true, name: 'Carol Google' },
    alice: { googleId: 'g-alice', email: 'alice@example.com', emailVerified: true, name: 'Alice G' },
    unverified: { googleId: 'g-x', email: 'x@example.com', emailVerified: false, name: 'X' },
    hijack: { googleId: 'g-other', email: 'alice@example.com', emailVerified: true, name: 'Not Alice' }
  });
  t.after(restore);

  let r = await api('GET', '/api/auth/config');
  assert.equal(r.body.googleClientId, 'test-client.apps.googleusercontent.com');

  r = await api('POST', '/api/auth/google', {});
  assert.equal(r.status, 400);
  r = await api('POST', '/api/auth/google', { credential: 'forged' });
  assert.equal(r.status, 401);
  r = await api('POST', '/api/auth/google', { credential: 'unverified' });
  assert.equal(r.status, 401);

  // New user
  r = await api('POST', '/api/auth/google', { credential: 'carol' });
  assert.equal(r.status, 201);
  assert.equal(r.body.created, true);
  assert.equal(r.body.user.email, 'carol@example.com');
  assert.equal(r.body.user.hasPassword, false);
  assert.equal(r.raw.includes('passwordHash'), false);
  const carolId = r.body.user.id;
  const me = await api('GET', '/api/auth/me', undefined, r.body.token);
  assert.equal(me.status, 200);

  // Same Google account again: same user, no duplicate
  r = await api('POST', '/api/auth/google', { credential: 'carol' });
  assert.equal(r.status, 200);
  assert.equal(r.body.created, false);
  assert.equal(r.body.user.id, carolId);

  // A Google-only account cannot log in with an empty password or change a password
  r = await api('POST', '/api/auth/login', { email: 'carol@example.com', password: '' });
  assert.notEqual(r.status, 200);
  const carolToken = (await api('POST', '/api/auth/google', { credential: 'carol' })).body.token;
  r = await api('PUT', '/api/profile/password', { currentPassword: 'x', newPassword: 'newpass123', confirmPassword: 'newpass123' }, carolToken);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Google/);

  // Existing email/password account gets linked, and the password keeps working
  r = await api('POST', '/api/auth/google', { credential: 'alice' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, alice.email);
  assert.equal(r.body.user.googleLinked, true);
  assert.equal(r.body.user.hasPassword, true);
  r = await api('POST', '/api/auth/login', { email: alice.email, password: alice.password });
  assert.equal(r.status, 200);

  // A different Google account cannot take over an already-linked email
  r = await api('POST', '/api/auth/google', { credential: 'hijack' });
  assert.equal(r.status, 409);
});

test('problem catalogue covers all required topics and has per-user status', async () => {
  const r = await api('GET', '/api/problems', undefined, aliceToken);
  assert.equal(r.status, 200);
  const topics = new Set(r.body.problems.map((p) => p.topic));
  ['Arrays', 'Strings', 'Hashing', 'Searching', 'Sorting', 'Linked List', 'Stack', 'Queue', 'Trees', 'Graphs', 'Dynamic Programming']
    .forEach((t) => assert.ok(topics.has(t), `missing topic ${t}`));
  assert.ok(r.body.problems.every((p) => p.status === 'Not Started'));
  assert.ok(r.body.problems.some((p) => p.recommended && p.recommendedReason));
  assert.ok(!r.raw.includes('referenceSolution') && !r.raw.includes('DT.out'), 'server-only data leaked');
});

test('problem detail exposes sample tests only (no hidden tests)', async () => {
  const r = await api('GET', '/api/problems/two-sum', undefined, aliceToken);
  assert.equal(r.status, 200);
  assert.ok(r.body.sampleTests.length > 0);
  assert.ok(r.body.hiddenTestCount > 0);
  assert.ok(!r.raw.includes('1, 5, 7, 12, 19'), 'hidden test input leaked');
  assert.ok(!r.raw.includes('referenceSolution'));
  assert.ok(r.body.starterCode.includes('class Solution'));

  const missing = await api('GET', '/api/problems/does-not-exist', undefined, aliceToken);
  assert.equal(missing.status, 404);
});

// ------------------------------------------------------------------ INPUT VALIDATION
test('run/submit validate input', async () => {
  let r = await api('POST', '/api/run', { problemId: 'two-sum', code: '   ' }, aliceToken);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /empty/);
  r = await api('POST', '/api/submit', { code: 'class Solution {}' }, aliceToken);
  assert.equal(r.status, 400);
  r = await api('POST', '/api/submit', { problemId: 'nope', code: 'class Solution {}' }, aliceToken);
  assert.equal(r.status, 404);
  r = await api('POST', '/api/run', { problemId: 'two-sum', code: 'x', language: 'ruby' }, aliceToken);
  assert.equal(r.status, 400);
  r = await api('POST', '/api/run', '{"problemId": "two-sum", code', aliceToken);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Malformed JSON/);
});

// ------------------------------------------------------------------ CODE EXECUTION (Judge0)
const TWO_SUM_OK = `import java.util.HashMap;
public class Solution {
    public int[] twoSum(int[] nums, int target) {
        HashMap<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) return new int[] { seen.get(target - nums[i]), i };
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}`;

let aliceSubmissionId;

test('Run Code executes sample tests only and stores nothing', { skip: SKIP_JUDGE0 }, async () => {
  const r = await api('POST', '/api/run', { problemId: 'two-sum', code: TWO_SUM_OK }, aliceToken);
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.status, 'Accepted');
  assert.equal(r.body.totalTestCases, 3);
  assert.ok(r.body.runtime.endsWith('ms'));
  const subs = await api('GET', '/api/submissions', undefined, aliceToken);
  assert.equal(subs.body.length, 0);
});

test('correct submission is Accepted on hidden tests and persisted', { skip: SKIP_JUDGE0 }, async () => {
  const r = await api('POST', '/api/submit', { problemId: 'two-sum', code: TWO_SUM_OK }, aliceToken);
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.body.status, 'Accepted');
  assert.equal(r.body.testCasesPassed, r.body.totalTestCases);
  assert.ok(r.body.totalTestCases > 3);
  assert.equal(r.body.analysis, null);
  aliceSubmissionId = r.body.submissionId;
  assert.ok(aliceSubmissionId);
});

test('wrong answer on edge cases is classified as Boundary Conditions; hidden tests stay hidden', { skip: SKIP_JUDGE0 }, async () => {
  const code = `class Solution {
    public int maxSubArray(int[] nums) {
        int best = 0, cur = 0;
        for (int x : nums) { cur = Math.max(x, cur + x); best = Math.max(best, cur); }
        return best;
    }
}`;
  const r = await api('POST', '/api/submit', { problemId: 'maximum-subarray', code }, aliceToken);
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.body.status, 'Wrong Answer');
  assert.equal(r.body.analysis.category, 'Boundary Conditions');
  const hidden = r.body.testResults.filter((t) => t.hidden);
  const revealed = hidden.filter((t) => t.input !== undefined);
  assert.ok(revealed.length <= 1, 'more than one hidden test revealed');
});

test('compilation error is reported with student line numbers and not counted as a mistake', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution {\n    public int search(int[] nums, int target) {\n        return -1\n    }\n}';
  const r = await api('POST', '/api/submit', { problemId: 'binary-search', code }, aliceToken);
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.body.status, 'Compilation Error');
  assert.match(r.body.compileOutput, /Line 3:/);
  assert.equal(r.body.mistakeCategory, null);
});

test('runtime exception is classified as Array Indexing with line evidence', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution {\n    public int[] runningSum(int[] nums) {\n        int[] r = new int[nums.length];\n        for (int i = 0; i <= nums.length; i++) r[i] = nums[i] + (i > 0 ? r[i - 1] : 0);\n        return r;\n    }\n}';
  const r = await api('POST', '/api/submit', { problemId: 'running-sum', code }, aliceToken);
  assert.equal(r.body.status, 'Runtime Error');
  assert.equal(r.body.analysis.category, 'Array Indexing');
  assert.ok(r.body.analysis.evidence.some((e) => e.includes('line 4') || e.includes('Line 4')));
});

test('null dereference is classified as Null Handling', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution {\n    public int maxDepth(TreeNode root) {\n        return 1 + Math.max(depth(root.left), depth(root.right));\n    }\n    int depth(TreeNode n) { return n == null ? 0 : 1 + Math.max(depth(n.left), depth(n.right)); }\n}';
  const r = await api('POST', '/api/submit', { problemId: 'max-depth', code }, aliceToken);
  assert.equal(r.body.status, 'Runtime Error');
  assert.equal(r.body.analysis.category, 'Null Handling');
});

test('infinite loop hits the time limit and is classified as Loop Logic', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution {\n    public int search(int[] nums, int target) {\n        int left = 0, right = nums.length - 1;\n        while (left <= right) {\n            int mid = (left + right) / 2;\n            if (nums[mid] == target) return mid;\n        }\n        return -1;\n    }\n}';
  const r = await api('POST', '/api/submit', { problemId: 'binary-search', code }, aliceToken);
  assert.equal(r.body.status, 'Time Limit Exceeded');
  assert.equal(r.body.analysis.category, 'Loop Logic');
  assert.equal(r.body.analysis.ruleId, 'LL-01');
});

// ------------------------------------------------------------------ PYTHON & C++
test('problem detail provides starter code for Java, Python and C++', async () => {
  const r = await api('GET', '/api/problems/two-sum', undefined, aliceToken);
  assert.deepEqual(r.body.languages.map((l) => l.id), ['java', 'python', 'cpp']);
  assert.match(r.body.starterCodes.python, /def twoSum\(self, nums: List\[int\], target: int\) -> List\[int\]:/);
  assert.match(r.body.starterCodes.cpp, /vector<int> twoSum\(vector<int>& nums, int target\)/);
});

test('Python: correct submission is Accepted and stored with its language', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution:\n    def reverseList(self, head):\n        prev = None\n        while head:\n            nxt = head.next\n            head.next = prev\n            prev = head\n            head = nxt\n        return prev';
  const r = await api('POST', '/api/submit', { problemId: 'reverse-linked-list', code, language: 'python' }, aliceToken);
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.body.status, 'Accepted');
  assert.equal(r.body.language, 'python');
  const one = await api('GET', `/api/submissions/${r.body.submissionId}`, undefined, aliceToken);
  assert.equal(one.body.language, 'python');
});

test('Python: None dereference is classified as Null Handling with line evidence', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution:\n    def middleNode(self, head):\n        slow = fast = head\n        while fast.next:\n            slow = slow.next\n            fast = fast.next.next\n        return slow';
  const r = await api('POST', '/api/submit', { problemId: 'middle-of-list', code, language: 'python' }, aliceToken);
  assert.equal(r.body.status, 'Runtime Error', r.raw);
  assert.equal(r.body.analysis.category, 'Null Handling');
  assert.ok(r.body.analysis.evidence.some((e) => /line 4/.test(e)), JSON.stringify(r.body.analysis.evidence));
});

test('Python: syntax error is reported as Compilation Error with the student line', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution:\n    def climbStairs(self, n: int) -> int\n        return n';
  const r = await api('POST', '/api/run', { problemId: 'climbing-stairs', code, language: 'python' }, aliceToken);
  assert.equal(r.body.status, 'Compilation Error', r.raw);
  assert.match(r.body.compileOutput, /Line 2/);
});

test('C++: out-of-bounds index is caught per test and classified as Array Indexing', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution {\npublic:\n    vector<int> runningSum(vector<int>& nums) {\n        vector<int> r(nums.size());\n        for (int i = 0; i <= (int)nums.size(); i++) r[i] = nums[i] + (i ? r[i - 1] : 0);\n        return r;\n    }\n};';
  const r = await api('POST', '/api/submit', { problemId: 'running-sum', code, language: 'cpp' }, aliceToken);
  assert.equal(r.body.status, 'Runtime Error', r.raw);
  assert.equal(r.body.analysis.category, 'Array Indexing');
  assert.equal(r.body.analysis.confidence, 'high');
  // every test ran in its own process, so all of them report a result
  assert.ok(r.body.testResults.every((t) => t.status !== 'Not Run'));
});

test('C++: compilation error maps to the student line', { skip: SKIP_JUDGE0 }, async () => {
  const code = 'class Solution {\npublic:\n    int climbStairs(int n) {\n        return n\n    }\n};';
  const r = await api('POST', '/api/run', { problemId: 'climbing-stairs', code, language: 'cpp' }, aliceToken);
  assert.equal(r.body.status, 'Compilation Error', r.raw);
  assert.match(r.body.compileOutput, /Line 4:/);
});

// ------------------------------------------------------------------ USER-SPECIFIC DATA
test('submissions persist and are only visible to their owner', { skip: SKIP_JUDGE0 }, async () => {
  const mine = await api('GET', '/api/submissions', undefined, aliceToken);
  assert.ok(mine.body.length >= 5);
  const one = await api('GET', `/api/submissions/${aliceSubmissionId}`, undefined, aliceToken);
  assert.equal(one.status, 200);
  assert.equal(one.body.code, TWO_SUM_OK);

  const theirs = await api('GET', '/api/submissions', undefined, bobToken);
  assert.equal(theirs.body.length, 0);
  const stolen = await api('GET', `/api/submissions/${aliceSubmissionId}`, undefined, bobToken);
  assert.equal(stolen.status, 404);
  const attempts = await api('GET', '/api/problems/two-sum/submissions', undefined, bobToken);
  assert.deepEqual(attempts.body, []);
});

test('dashboard, analytics and mistakes reflect only the user\'s own submissions', { skip: SKIP_JUDGE0 }, async () => {
  const a = await api('GET', '/api/dashboard', undefined, aliceToken);
  assert.equal(a.status, 200);
  assert.ok(a.body.overview.totalSubmissions >= 6);
  assert.ok(a.body.overview.problemsSolved >= 1);
  assert.ok(a.body.mistakeSummary.totalMistakes >= 3);
  assert.ok(!a.body.recommendations.some((r) => r.problemId === 'two-sum'), 'solved problem recommended');
  assert.ok(a.body.recommendations.every((r) => r.reason && r.reason.length > 10));

  const b = await api('GET', '/api/dashboard', undefined, bobToken);
  assert.equal(b.body.overview.totalSubmissions, 0);
  assert.equal(b.body.mistakeSummary.totalMistakes, 0);

  const an = await api('GET', '/api/analytics', undefined, aliceToken);
  assert.ok(an.body.topicStats.find((t) => t.topic === 'Arrays').submissions >= 2);
  const m = await api('GET', '/api/mistakes', undefined, aliceToken);
  assert.ok(m.body.history.length >= 3);
  assert.ok(m.body.rules.length >= 10);

  const catalogue = await api('GET', '/api/problems', undefined, aliceToken);
  assert.equal(catalogue.body.problems.find((p) => p.id === 'two-sum').status, 'Solved');
  assert.equal(catalogue.body.problems.find((p) => p.id === 'binary-search').status, 'Attempted');
  const bobCatalogue = await api('GET', '/api/problems', undefined, bobToken);
  assert.equal(bobCatalogue.body.problems.find((p) => p.id === 'two-sum').status, 'Not Started');
});

// ------------------------------------------------------------------ PROFILE & SETTINGS
test('profile update, password change and settings validation', async () => {
  let r = await api('PUT', '/api/profile', { name: 'A' }, aliceToken);
  assert.equal(r.status, 400);
  r = await api('PUT', '/api/profile', { name: 'Alice Updated', university: 'Test University', email: 'hacker@x.com' }, aliceToken);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.name, 'Alice Updated');
  assert.equal(r.body.user.email, alice.email, 'email must not change through profile update');

  r = await api('PUT', '/api/profile/password', { currentPassword: 'wrong', newPassword: 'newpass123', confirmPassword: 'newpass123' }, aliceToken);
  assert.equal(r.status, 400);
  r = await api('PUT', '/api/profile/password', { currentPassword: alice.password, newPassword: 'newpass123', confirmPassword: 'newpass123' }, aliceToken);
  assert.equal(r.status, 200);
  r = await api('POST', '/api/auth/login', { email: alice.email, password: 'newpass123' });
  assert.equal(r.status, 200);

  r = await api('PUT', '/api/settings', { editorFontSize: 99 }, aliceToken);
  assert.equal(r.status, 400);
  r = await api('PUT', '/api/settings', { editorFontSize: 16, wordWrap: true }, aliceToken);
  assert.equal(r.status, 200);
  assert.equal(r.body.settings.editorFontSize, 16);
  r = await api('GET', '/api/settings', undefined, aliceToken);
  assert.equal(r.body.settings.wordWrap, true);

  r = await api('GET', '/api/profile', undefined, aliceToken);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.achievements));
  assert.ok(!r.raw.includes('passwordHash'));
});

test('rate limiter blocks requests over the limit', () => {
  delete process.env.DISABLE_RATE_LIMIT;
  const limiter = rateLimit({ windowMs: 60000, max: 2 });
  const statuses = [];
  const res = { set() {}, status(code) { statuses.push(code); return { json() {} }; } };
  for (let i = 0; i < 3; i++) limiter({ ip: '1.2.3.4' }, res, () => statuses.push(200));
  process.env.DISABLE_RATE_LIMIT = '1';
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('unknown API routes return JSON 404 and the database file is not served', async () => {
  const r = await api('GET', '/api/nothing-here', undefined, aliceToken);
  assert.equal(r.status, 404);
  const db = await fetch(`${base}/backend/debugtrack.db`);
  assert.notEqual(db.status, 200);
  const secret = await fetch(`${base}/backend/.jwt-secret`);
  assert.notEqual(secret.status, 200);
});
