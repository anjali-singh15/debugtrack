/**
 * Unit tests for the rule-based mistake engine and the Judge0 harness helpers.
 * These use synthetic execution results, so they need no network access.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSubmission, findLengthInclusiveBounds, findStuckWhileLoops, RULES, CATEGORIES } = require('../mistakeEngine');
const { parseHarnessOutput, outputsMatch, buildHarness } = require('../judgeService');

const problem = { id: 'demo', topic: 'Arrays', starterCode: 'class Solution { public int f(int[] a) { return 0; } }' };

function exec(verdict, tests, extra = {}) {
  return { verdict, tests, compileOutput: '', stderr: '', ...extra };
}
const pass = (id, extra = {}) => ({ id, input: `in${id}`, expected: '1', actual: '1', passed: true, status: 'Passed', hidden: false, edge: null, ...extra });
const fail = (id, extra = {}) => ({ id, input: `in${id}`, expected: '1', actual: '5', passed: false, status: 'Wrong Answer', hidden: false, edge: null, ...extra });

test('accepted submissions produce no mistake', () => {
  assert.equal(analyzeSubmission({ code: 'x', problem, execution: exec('Accepted', [pass(1)]) }), null);
});

test('AI-01: ArrayIndexOutOfBoundsException -> Array Indexing with off-by-one evidence', () => {
  const code = 'class Solution {\n  int f(int[] a) {\n    for (int i = 0; i <= a.length; i++) s += a[i];\n  }\n}';
  const t = fail(1, { status: 'Runtime Error', error: { type: 'ArrayIndexOutOfBoundsException', message: 'Index 5 out of bounds for length 5', line: 3 } });
  const r = analyzeSubmission({ code, problem, execution: exec('Runtime Error', [t]) });
  assert.equal(r.category, 'Array Indexing');
  assert.equal(r.confidence, 'high');
  assert.equal(r.ruleId, 'AI-01');
  assert.ok(r.evidence.some((e) => e.includes('equals the length')));
  assert.ok(r.evidence.some((e) => e.includes('Line 3')));
  assert.equal(r.practiceTopic, 'Arrays');
});

test('AI-01: negative index evidence', () => {
  const t = fail(1, { status: 'Runtime Error', error: { type: 'ArrayIndexOutOfBoundsException', message: 'Index -1 out of bounds for length 4', line: 1 } });
  const r = analyzeSubmission({ code: 'r[i] = r[i - 1] + a[i];', problem, execution: exec('Runtime Error', [t]) });
  assert.equal(r.category, 'Array Indexing');
  assert.ok(r.evidence.some((e) => e.includes('negative index')));
});

test('NH-01: NullPointerException -> Null Handling and notes missing null checks', () => {
  const t = fail(3, { status: 'Runtime Error', edge: 'empty list', hidden: true, error: { type: 'NullPointerException', message: 'Cannot read field "next" because "<local1>" is null', line: 4 } });
  const r = analyzeSubmission({ code: 'while (curr.next != head) {}', problem, execution: exec('Runtime Error', [pass(1), t]) });
  assert.equal(r.category, 'Null Handling');
  assert.equal(r.confidence, 'high');
  assert.ok(r.evidence.some((e) => e.includes('a local variable')));
  assert.ok(r.evidence.some((e) => e.includes('No null / None check')));
  assert.ok(r.evidence.some((e) => e.includes('edge case (empty list)')));
});

test('LL-01: TLE with a stuck while loop -> Loop Logic (high)', () => {
  const code = 'int f(int[] p, int x) {\n  while (p[x] != x) {\n    p[x] = p[p[x]];\n  }\n  return x;\n}';
  const r = analyzeSubmission({ code, problem, execution: exec('Time Limit Exceeded', [pass(1), fail(2, { status: 'Time Limit Exceeded' })]) });
  assert.equal(r.category, 'Loop Logic');
  assert.equal(r.ruleId, 'LL-01');
  assert.equal(r.confidence, 'high');
});

test('LL-02: TLE without a provably stuck loop -> Possible Loop Logic', () => {
  const code = 'int climb(int n) {\n  if (n <= 2) return n;\n  return climb(n - 1) + climb(n - 2);\n}';
  const r = analyzeSubmission({ code, problem, execution: exec('Time Limit Exceeded', [pass(1), fail(2, { status: 'Time Limit Exceeded' })]) });
  assert.equal(r.category, 'Loop Logic');
  assert.equal(r.confidence, 'possible');
  assert.match(r.title, /^Possible mistake/);
  assert.ok(r.evidence.some((e) => e.includes('memoisation')));
});

test('BC-01: only edge cases fail -> Boundary Conditions', () => {
  const tests = [pass(1), pass(2), fail(3, { edge: 'single element' }), fail(4, { edge: 'empty array', hidden: true })];
  const r = analyzeSubmission({ code: 'x', problem, execution: exec('Wrong Answer', tests) });
  assert.equal(r.category, 'Boundary Conditions');
  assert.equal(r.ruleId, 'BC-01');
  assert.match(r.suggestion, /single element, empty array/);
});

test('LL-03: all wrong answers off by exactly one -> Possible Loop Logic', () => {
  const tests = [pass(1), fail(2, { expected: '2', actual: '3' }), fail(3, { expected: '7', actual: '6' })];
  const r = analyzeSubmission({ code: 'x', problem, execution: exec('Wrong Answer', tests) });
  assert.equal(r.category, 'Loop Logic');
  assert.equal(r.confidence, 'possible');
});

test('UC-01: insufficient evidence -> Unclassified, never a guessed category', () => {
  const tests = [pass(1), fail(2, { expected: '[1, 2]', actual: '[9, 9]' })];
  const r = analyzeSubmission({ code: 'x', problem, execution: exec('Wrong Answer', tests) });
  assert.equal(r.category, 'Unclassified');
  assert.equal(r.ruleId, 'UC-01');
  assert.ok(r.suggestion.length > 10);
});

test('Runtime Errors: StackOverflowError, ArithmeticException, EmptyStackException', () => {
  const mk = (type) => analyzeSubmission({ code: 'x', problem, execution: exec('Runtime Error', [fail(1, { status: 'Runtime Error', error: { type, message: 'm', line: null } })]) });
  assert.equal(mk('StackOverflowError').ruleId, 'RE-01');
  assert.equal(mk('ArithmeticException').ruleId, 'RE-02');
  assert.equal(mk('EmptyStackException').ruleId, 'RE-03');
  assert.equal(mk('NumberFormatException').ruleId, 'RE-04');
  ['StackOverflowError', 'ArithmeticException', 'EmptyStackException'].forEach((t) => assert.equal(mk(t).category, 'Runtime Errors'));
});

test('Compilation errors and unchanged starter code are not counted as mistake patterns', () => {
  const ce = analyzeSubmission({ code: 'x', problem, execution: exec('Compilation Error', [], { compileOutput: "Line 3: error: ';' expected" }) });
  assert.equal(ce.category, null);
  assert.equal(ce.ruleId, 'CE-01');
  const starter = analyzeSubmission({ code: problem.starterCode, problem, execution: exec('Wrong Answer', [fail(1)]) });
  assert.equal(starter.category, null);
  assert.equal(starter.ruleId, 'NS-01');
});

test('code pattern helpers', () => {
  assert.equal(findLengthInclusiveBounds('for (int i = 0; i <= nums.length; i++)').length, 1);
  assert.equal(findLengthInclusiveBounds('for (int i = 0; i <= nums.length - 1; i++)').length, 0);
  assert.equal(findLengthInclusiveBounds('while (i <= s.length())').length, 1);
  assert.equal(findStuckWhileLoops('while (l < r) { mid = 3; }').length, 1);
  assert.equal(findStuckWhileLoops('while (l < r) { l++; }').length, 0);
  assert.equal(findStuckWhileLoops('while (!q.isEmpty()) { q.poll(); }').length, 0);
  assert.equal(findStuckWhileLoops('while (cur != null) cur = cur.next;').length, 0);
});

test('rule catalogue covers every category', () => {
  CATEGORIES.forEach((c) => assert.ok(RULES.some((r) => r.category === c), `missing rule for ${c}`));
});

test('harness output parsing separates student prints, results and errors', () => {
  const tests = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const out = '---TC_1---\ndebug line\n@@RESULT@@[0, 1]\n---TC_2---\npartial@@RESULT@@42\n---TC_3---\n@@ERROR@@java.lang.NullPointerException@@4@@boom\n';
  const p = parseHarnessOutput(out, tests);
  assert.equal(p[1].actual, '[0, 1]');
  assert.deepEqual(p[1].stdout, ['debug line']);
  assert.equal(p[2].actual, '42');
  assert.deepEqual(p[2].stdout, ['partial']);
  assert.equal(p[3].error.type, 'NullPointerException');
  assert.equal(p[3].error.line, 4);
});

test('output comparison normalises spacing but keeps string content exact', () => {
  assert.ok(outputsMatch('[0,1]', '[0, 1]'));
  assert.ok(outputsMatch('[1, 0]', '[0, 1]', 'unordered'));
  assert.ok(!outputsMatch('[1, 0]', '[0, 1]'));
  assert.ok(!outputsMatch('"world  hello"', '"world hello"'));
  assert.ok(!outputsMatch(undefined, '1'));
});

test('harness hoists imports without shifting student line numbers', () => {
  const code = 'import java.util.HashMap;\npublic class Solution {\n  int f() { return 1; }\n}';
  const { source, userStart } = buildHarness(code, [{ id: 1, call: 'DT.out(sol.f());' }]);
  const lines = source.split('\n');
  assert.equal(lines[userStart - 1], '');                       // import line blanked in place
  assert.equal(lines[userStart].trim(), 'class Solution {');      // "public" removed, same line
  assert.ok(lines.slice(0, userStart).includes('import java.util.HashMap;'));
});

// ------------------------------------------------------------------ Python & C++ harness helpers
const python = require('../languages/python');
const cpp = require('../languages/cpp');

test('Python errors map to language-neutral kinds', () => {
  assert.equal(python.errorKind('IndexError', 'list index out of range'), 'index');
  assert.equal(python.errorKind('IndexError', 'pop from empty list'), 'empty-collection');
  assert.equal(python.errorKind('AttributeError', "'NoneType' object has no attribute 'next'"), 'null');
  assert.equal(python.errorKind('RecursionError', 'maximum recursion depth exceeded'), 'stack-overflow');
  assert.equal(python.errorKind('ZeroDivisionError', 'division by zero'), 'arithmetic');
  assert.equal(python.errorKind('KeyError', '5'), 'other');
});

test('C++ crash output is turned into an error with a clean stdout', () => {
  const lines = ['my debug print', '/usr/local/gcc-9.2.0/include/c++/9.2.0/debug/vector:427:', 'In function:', '    std::__debug::vector<...>::operator[]',
    'Error: attempt to subscript container with out-of-bounds index 5, but ', 'container only holds 5 elements.'];
  const c = cpp.crashError(6, lines);
  assert.equal(c.error.kind, 'index');
  assert.deepEqual(c.stdout, ['my debug print']);
  assert.match(c.error.message, /index 5, but container only holds 5 elements/);
  assert.equal(cpp.crashError(11, []).error.kind, 'segfault');
  assert.equal(cpp.crashError(8, []).error.kind, 'arithmetic');
});

test('C++ off-by-one crash yields Array Indexing with the off-by-one note', () => {
  const t = fail(1, { status: 'Runtime Error', error: { type: 'Aborted (SIGABRT)', kind: 'index', message: 'attempt to subscript container with out-of-bounds index 5, but container only holds 5 elements.', line: null } });
  const r = analyzeSubmission({ code: 'for (int i = 0; i <= nums.size(); i++)', problem, execution: exec('Runtime Error', [t]), language: 'cpp' });
  assert.equal(r.category, 'Array Indexing');
  assert.ok(r.evidence.some((e) => e.includes('equals the length')));
});

test('C++ segfault is only a possible mistake, category depends on the topic', () => {
  const t = fail(1, { status: 'Runtime Error', error: { type: 'Segmentation fault (SIGSEGV)', kind: 'segfault', message: '', line: null } });
  const list = analyzeSubmission({ code: 'x', problem: { ...problem, topic: 'Linked List' }, execution: exec('Runtime Error', [t]), language: 'cpp' });
  assert.equal(list.category, 'Null Handling');
  assert.equal(list.confidence, 'possible');
  const arr = analyzeSubmission({ code: 'x', problem, execution: exec('Runtime Error', [t]), language: 'cpp' });
  assert.equal(arr.category, 'Array Indexing');
  assert.equal(arr.confidence, 'possible');
});

test('generated Python and C++ harnesses contain every test call', () => {
  const { PROBLEMS } = require('../data/problems');
  const p = PROBLEMS.find((x) => x.id === 'merge-sorted-array');
  const py = python.buildHarness('class Solution: pass', p.tests, p.signature).source;
  assert.match(py, /a0 = \[1, 2, 3, 0, 0, 0\]/);
  assert.match(py, /_dt_out\(a0\)/);
  const cc = cpp.buildHarness('class Solution {};', p.tests, p.signature).source;
  assert.match(cc, /vector<int> a0 = \{1, 2, 3, 0, 0, 0\};/);
  assert.match(cc, /dt::out\(dt::fmt\(a0\)\)/);
  assert.equal((cc.match(/dt::run\(/g) || []).length, p.tests.length);
});
