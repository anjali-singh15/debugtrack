/**
 * Bulk problem import: validates problems from a JSON file, generates the Java test calls and
 * starter code the harnesses expect, verifies them on Judge0, and inserts them in ONE transaction.
 *
 * Imported problems use the same storage format as the curated bank in data/problems.js:
 * each test keeps a Java `call` (run by the Java harness) and language-neutral `args`
 * (used to generate the Python / C++ calls), so every language runs identical tests.
 *
 * Existing problems are never updated or deleted: inserts use plain INSERT (no upsert), and a
 * problem whose id or title already exists is reported as a duplicate and skipped.
 */
const { run, get, all, exec } = require('../database');
const { TOPICS, invalidateCache } = require('./problemService');
const { CATEGORIES } = require('../mistakeEngine');
const { parseJavaCall } = require('../data/signatures');
const { starterCodes, LANGUAGE_IDS } = require('../languages');

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const PARAM_TYPES = ['int', 'boolean', 'String', 'int[]', 'int[][]', 'String[]', 'char[][]', 'ListNode', 'TreeNode'];
// Return types every language harness can print (see languages/*.js)
const RETURN_TYPES = ['int', 'boolean', 'String', 'int[]', 'int[][]', 'ListNode', 'List<List<Integer>>', 'void'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const METHOD_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const MAX_PROBLEMS = 200;
const MAX_TESTS = 50;

const isInt = (v) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;
const isStr = (v) => typeof v === 'string';
const isArr = Array.isArray;
const isStrList = (v) => isArr(v) && v.every(isStr);

/** Checks a JSON value against a signature type. */
const TYPE_CHECKS = {
  int: isInt,
  boolean: (v) => typeof v === 'boolean',
  String: isStr,
  'int[]': (v) => isArr(v) && v.every(isInt),
  'int[][]': (v) => isArr(v) && v.every((r) => isArr(r) && r.every(isInt)),
  'String[]': isStrList,
  'char[][]': isStrList, // one string per grid row, e.g. ["110", "010"]
  ListNode: (v) => isArr(v) && v.every(isInt),
  TreeNode: (v) => isArr(v) && v.every((x) => x === null || isInt(x)), // level order, null = missing child
  'List<List<Integer>>': (v) => isArr(v) && v.every((r) => isArr(r) && r.every(isInt))
};

const TYPE_HINTS = {
  int: 'a 32-bit integer', boolean: 'true or false', String: 'a string', 'int[]': 'an array of integers',
  'int[][]': 'an array of integer arrays', 'String[]': 'an array of strings', 'char[][]': 'an array of row strings, e.g. ["10", "01"]',
  ListNode: 'an array of integers (list values in order)', TreeNode: 'a level-order array of integers or null',
  'List<List<Integer>>': 'an array of integer arrays'
};

// ------------------------------------------------------------------ Java generation

/** Java expression for an argument value (the same forms the curated bank uses). */
function javaValue(value, type) {
  const list = (v) => v.join(', ');
  switch (type) {
    case 'int': return String(value);
    case 'boolean': return String(value);
    case 'String': return JSON.stringify(value);
    case 'int[]': return `new int[]{${list(value)}}`;
    case 'int[][]': return `new int[][]{${value.map((r) => `{${list(r)}}`).join(', ')}}`;
    case 'String[]': return `new String[]{${value.map((s) => JSON.stringify(s)).join(', ')}}`;
    case 'char[][]': return `DT.grid(${value.map((s) => JSON.stringify(s)).join(', ')})`;
    case 'ListNode': return `DT.list(${list(value)})`;
    case 'TreeNode': return `DT.tree(${value.map((x) => (x === null ? 'null' : x)).join(', ')})`;
    default: throw new Error(`Unsupported parameter type ${type}`);
  }
}

/** Java statements that run one test and print its result through the DT helper. */
function buildJavaCall(sig, args) {
  if (sig.returns === 'void') {
    const target = sig.inplace;
    const callArgs = sig.params.map(([, type], i) => (i === target ? 'a' : javaValue(args[i], type)));
    return `{ int[] a = {${args[target].join(', ')}}; sol.${sig.method}(${callArgs.join(', ')}); DT.out(a); }`;
  }
  const call = `sol.${sig.method}(${sig.params.map(([, type], i) => javaValue(args[i], type)).join(', ')})`;
  if (sig.returns === 'ListNode') return `DT.outList(${call});`;
  if (sig.returns === 'String') return `DT.outStr(${call});`;
  return `DT.out(${call});`;
}

/** Display form of a value: "[1, 2]", "\"abc\"", "true" (matches the harness output format). */
function displayValue(v) {
  if (v === null) return 'null';
  if (isArr(v)) return '[' + v.map(displayValue).join(', ') + ']';
  if (isStr(v)) return JSON.stringify(v);
  return String(v);
}

const JAVA_DEFAULTS = {
  int: '0', boolean: 'false', String: '""', 'int[]': 'new int[0]', 'int[][]': 'new int[0][]',
  ListNode: 'null', 'List<List<Integer>>': 'new ArrayList<>()'
};

function javaStarter(sig) {
  const params = sig.params.map(([name, type]) => `${type} ${name}`).join(', ');
  const body = sig.returns === 'void'
    ? `        // Modify ${sig.params[sig.inplace][0]} in place`
    : `        // Write your solution here\n        return ${JAVA_DEFAULTS[sig.returns]};`;
  return `class Solution {\n    public ${sig.returns} ${sig.method}(${params}) {\n${body}\n    }\n}`;
}

// ------------------------------------------------------------------ validation

function parseImportFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { error: `Malformed JSON: ${err.message}` };
  }
  const problems = isArr(data) ? data : data && isArr(data.problems) ? data.problems : null;
  if (!problems) return { error: 'The file must be a JSON array of problems, or an object with a "problems" array.' };
  if (!problems.length) return { error: 'The file contains no problems.' };
  if (problems.length > MAX_PROBLEMS) return { error: `At most ${MAX_PROBLEMS} problems can be imported at once (found ${problems.length}).` };
  const source = !isArr(data) && data.source && typeof data.source === 'object' ? data.source : null;
  return { problems, source };
}

function validateSignature(sig, errors) {
  if (!sig || typeof sig !== 'object') { errors.push('"signature" is required: { method, params, returns }.'); return false; }
  const before = errors.length;
  if (!isStr(sig.method) || !METHOD_PATTERN.test(sig.method)) errors.push('"signature.method" must be a valid method name, e.g. "twoSum".');
  if (!isArr(sig.params) || !sig.params.length) {
    errors.push('"signature.params" must be a non-empty array of [name, type] pairs.');
  } else {
    sig.params.forEach((p, i) => {
      if (!isArr(p) || p.length !== 2 || !isStr(p[0]) || !METHOD_PATTERN.test(p[0])) errors.push(`signature.params[${i}] must be [name, type] with a valid parameter name.`);
      else if (!PARAM_TYPES.includes(p[1])) errors.push(`signature.params[${i}] has unsupported type "${p[1]}". Supported: ${PARAM_TYPES.join(', ')}.`);
    });
  }
  if (!RETURN_TYPES.includes(sig.returns)) errors.push(`"signature.returns" must be one of: ${RETURN_TYPES.join(', ')}.`);
  if (sig.returns === 'void') {
    const p = isArr(sig.params) ? sig.params[sig.inplace] : null;
    if (!Number.isInteger(sig.inplace) || !p) errors.push('A void method needs "signature.inplace": the index of the parameter it modifies.');
    else if (p[1] !== 'int[]') errors.push('In-place (void) methods are only supported for an int[] parameter.');
  } else if (sig.inplace !== undefined) {
    errors.push('"signature.inplace" is only allowed when "returns" is "void".');
  }
  return errors.length === before;
}

/**
 * Validates and normalises one raw problem into the stored format.
 * Returns { problem, errors, warnings }; `problem` is null when there are errors.
 */
function normalizeProblem(raw) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object' || isArr(raw)) return { problem: null, errors: ['Each problem must be a JSON object.'], warnings };

  const reqString = (field) => {
    if (!isStr(raw[field]) || !raw[field].trim()) errors.push(`"${field}" is required and must be a non-empty string.`);
  };
  ['id', 'title', 'description', 'referenceSolution'].forEach(reqString);
  if (isStr(raw.id) && raw.id && !ID_PATTERN.test(raw.id)) errors.push('"id" must be lowercase letters, digits and hyphens (max 64), e.g. "mbpp-12".');
  if (isStr(raw.title) && raw.title.length > 120) errors.push('"title" must be at most 120 characters.');
  if (!DIFFICULTIES.includes(raw.difficulty)) errors.push(`"difficulty" must be one of: ${DIFFICULTIES.join(', ')}.`);
  if (!TOPICS.includes(raw.topic)) errors.push(`"topic" must be one of: ${TOPICS.join(', ')}.`);

  const optStrList = (field) => {
    if (raw[field] === undefined) return [];
    if (!isStrList(raw[field])) { errors.push(`"${field}" must be an array of strings.`); return []; }
    return raw[field];
  };
  const constraints = optStrList('constraints');
  const hints = optStrList('hints');
  let focus = [];
  if (raw.focus !== undefined) {
    if (!isStrList(raw.focus)) errors.push('"focus" must be an array of mistake categories.');
    else {
      const bad = raw.focus.filter((c) => !CATEGORIES.includes(c) || c === 'Unclassified');
      if (bad.length) errors.push(`"focus" has unknown categories: ${bad.join(', ')}. Allowed: ${CATEGORIES.filter((c) => c !== 'Unclassified').join(', ')}.`);
      focus = raw.focus;
    }
  }
  if (!focus.length) warnings.push('No "focus" categories: the problem will not be recommended for specific mistake patterns.');
  if (raw.mistakeProneArea !== undefined && !isStr(raw.mistakeProneArea)) errors.push('"mistakeProneArea" must be a string.');

  const sig = raw.signature;
  const sigOk = validateSignature(sig, errors);
  if (sigOk && raw.starterCode !== undefined) {
    if (!isStr(raw.starterCode) || !raw.starterCode.includes(sig.method)) errors.push(`"starterCode" must be Java code that declares ${sig.method}.`);
  }
  if (sigOk && isStr(raw.referenceSolution) && !raw.referenceSolution.includes(sig.method)) {
    errors.push(`"referenceSolution" must be a Java Solution class that declares ${sig.method}.`);
  }

  // ---- tests
  const tests = [];
  if (!isArr(raw.tests) || !raw.tests.length) {
    errors.push('"tests" is required: a non-empty array of { args, expected }.');
  } else if (raw.tests.length > MAX_TESTS) {
    errors.push(`At most ${MAX_TESTS} tests per problem.`);
  } else if (sigOk) {
    raw.tests.forEach((tc, i) => {
      const where = `tests[${i}]`;
      if (!tc || typeof tc !== 'object') { errors.push(`${where} must be an object.`); return; }
      if (!isArr(tc.args) || tc.args.length !== sig.params.length) {
        errors.push(`${where}.args must be an array of ${sig.params.length} value(s), one per parameter.`);
        return;
      }
      let argsOk = true;
      sig.params.forEach(([name, type], j) => {
        if (!TYPE_CHECKS[type](tc.args[j])) { argsOk = false; errors.push(`${where}.args[${j}] (${name}) must be ${TYPE_HINTS[type]}.`); }
      });
      const outType = sig.returns === 'void' ? 'int[]' : sig.returns;
      if (tc.expected === undefined) { errors.push(`${where}.expected is required.`); argsOk = false; }
      else if (!TYPE_CHECKS[outType](tc.expected)) { errors.push(`${where}.expected must be ${TYPE_HINTS[outType]}${sig.returns === 'void' ? ' (the array after modification)' : ''}.`); argsOk = false; }
      if (tc.hidden !== undefined && typeof tc.hidden !== 'boolean') errors.push(`${where}.hidden must be true or false.`);
      if (tc.edge !== undefined && (!isStr(tc.edge) || !tc.edge.trim())) errors.push(`${where}.edge must be a short label, e.g. "empty array".`);
      if (tc.compare !== undefined && tc.compare !== 'unordered') errors.push(`${where}.compare may only be "unordered".`);
      if (tc.compare === 'unordered' && outType !== 'int[]') errors.push(`${where}.compare "unordered" is only supported for int[] results.`);
      if (tc.input !== undefined && !isStr(tc.input)) errors.push(`${where}.input must be a string.`);
      if (!argsOk) return;

      const call = buildJavaCall(sig, tc.args);
      // Round-trip through the same parser the curated bank uses, so the Python/C++ harnesses
      // receive exactly the values the Java call passes.
      let parsed;
      try { parsed = parseJavaCall(call, sig); } catch (err) { errors.push(`${where}: could not build a test call (${err.message}).`); return; }
      if (JSON.stringify(parsed) !== JSON.stringify(tc.args)) { errors.push(`${where}: argument values could not be represented exactly.`); return; }

      const test = {
        input: tc.input || sig.params.map(([name], j) => `${name} = ${displayValue(tc.args[j])}`).join(', '),
        expected: displayValue(tc.expected), // the format the harness prints
        call,
        hidden: tc.hidden === true,
        id: i + 1,
        args: parsed
      };
      if (tc.edge) test.edge = tc.edge.trim();
      if (tc.compare) test.compare = tc.compare;
      tests.push(test);
    });
    if (tests.length === raw.tests.length) {
      if (!tests.some((t) => !t.hidden)) errors.push('At least one test must be visible ("hidden": false) so Run Code has a sample test.');
      if (!tests.some((t) => t.hidden)) warnings.push('No hidden tests: Submit will only run the sample tests.');
      if (!tests.some((t) => t.edge)) warnings.push('No test has an "edge" label: Boundary Conditions mistakes cannot be detected for this problem.');
    }
  }

  // ---- examples (shown on the problem page); default: the visible tests
  let examples = [];
  if (raw.examples !== undefined) {
    if (!isArr(raw.examples) || !raw.examples.every((e) => e && isStr(e.input) && isStr(e.output) && (e.explanation === undefined || isStr(e.explanation)))) {
      errors.push('"examples" must be an array of { input, output, explanation? } strings.');
    } else examples = raw.examples;
  } else {
    examples = tests.filter((t) => !t.hidden).slice(0, 2).map((t) => ({ input: t.input, output: t.expected }));
  }

  if (errors.length) return { problem: null, errors, warnings };
  return {
    problem: {
      id: raw.id,
      title: raw.title.trim(),
      difficulty: raw.difficulty,
      topic: raw.topic,
      focus,
      signature: { method: sig.method, params: sig.params, returns: sig.returns, ...(sig.returns === 'void' ? { inplace: sig.inplace } : {}) },
      mistakeProneArea: raw.mistakeProneArea || '',
      description: raw.description,
      examples,
      constraints,
      hints,
      starterCode: raw.starterCode || javaStarter(sig),
      referenceSolution: raw.referenceSolution,
      tests
    },
    errors,
    warnings
  };
}

const titleKey = (title) => String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Validates every problem in an import file against the schema and the database.
 * Returns { valid, duplicates, invalid, warnings } without writing anything.
 */
async function validateImport(rawProblems) {
  const existing = await all('SELECT id, title FROM problems');
  const ids = new Map(existing.map((r) => [r.id, 'already in the database']));
  const titles = new Map(existing.map((r) => [titleKey(r.title), `already in the database as "${r.id}"`]));

  const report = { valid: [], duplicates: [], invalid: [], warnings: [] };
  rawProblems.forEach((raw, index) => {
    const label = raw && isStr(raw.id) ? raw.id : `#${index + 1}`;
    const { problem, errors, warnings } = normalizeProblem(raw);
    if (!problem) { report.invalid.push({ index, id: label, errors }); return; }

    const reason = ids.has(problem.id) ? `id "${problem.id}" ${ids.get(problem.id)}`
      : titles.has(titleKey(problem.title)) ? `title "${problem.title}" ${titles.get(titleKey(problem.title))}` : null;
    if (reason) { report.duplicates.push({ index, id: problem.id, reason }); return; }

    ids.set(problem.id, 'appears earlier in this file');
    titles.set(titleKey(problem.title), `appears earlier in this file as "${problem.id}"`);
    if (warnings.length) report.warnings.push({ id: problem.id, warnings });
    report.valid.push(problem);
  });
  return report;
}

// ------------------------------------------------------------------ Judge0 verification

/** True when an error means Judge0 could not be reached / used, rather than a bad problem. */
function isServiceError(err) {
  if (!err) return false;
  if (err.name === 'ExecutionServiceError') return true;
  const text = `${err.message || ''} ${err.code || ''} ${(err.cause && err.cause.code) || ''}`;
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNRESET/i.test(text);
}

/**
 * Verifies one problem the same way scripts/verifyProblems.js does: the Java reference must be
 * Accepted on ALL tests, and the generated starter must compile in every language.
 * Throws when Judge0 is unavailable (the caller aborts the whole import).
 */
async function verifyProblem(problem, { execute, delayMs = 400 } = {}) {
  const exec = execute || require('../judgeService').executeCode;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const p = { ...problem, starterCodes: starterCodes(problem) };
  const failures = [];

  const ref = await exec(p.referenceSolution, p, { language: 'java', includeHidden: true });
  if (ref.verdict !== 'Accepted') {
    failures.push(`reference solution: ${ref.verdict} (${ref.testsPassed}/${ref.testsTotal} tests)`);
    (ref.tests || []).filter((t) => !t.passed).slice(0, 3)
      .forEach((t) => failures.push(`  test ${t.id}: input ${t.input}, expected ${t.expected}, got ${t.actual === undefined ? '(no output)' : t.actual}`));
    if (ref.compileOutput) failures.push(`  ${ref.compileOutput.split('\n').slice(0, 3).join(' | ')}`);
  }
  for (const lang of LANGUAGE_IDS) {
    if (delayMs) await sleep(delayMs);
    const r = await exec(p.starterCodes[lang], p, { language: lang, includeHidden: false });
    if (r.verdict === 'Compilation Error') failures.push(`${lang} starter does not compile: ${(r.compileOutput || '').split('\n')[0]}`);
  }
  return { ok: failures.length === 0, failures };
}

// ------------------------------------------------------------------ insertion

/**
 * Inserts problems in ONE transaction. Uses plain INSERT, so an id that already exists makes
 * the whole batch roll back instead of overwriting anything. Returns the inserted ids.
 */
async function insertProblems(problems) {
  if (!problems.length) return [];
  await exec('BEGIN IMMEDIATE');
  try {
    const { maxNumber } = await get('SELECT COALESCE(MAX(number), 0) AS maxNumber FROM problems');
    let number = maxNumber;
    for (const p of problems) {
      number += 1;
      await run(
        `INSERT INTO problems (id, number, title, difficulty, topic, focus, signature, mistakeProneArea, description, examples, constraints, hints, starterCode, testCases, referenceSolution)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, number, p.title, p.difficulty, p.topic, JSON.stringify(p.focus), JSON.stringify(p.signature), p.mistakeProneArea, p.description,
          JSON.stringify(p.examples), JSON.stringify(p.constraints), JSON.stringify(p.hints), p.starterCode,
          JSON.stringify(p.tests), p.referenceSolution]
      );
    }
    await exec('COMMIT');
  } catch (err) {
    await exec('ROLLBACK').catch(() => {});
    throw err;
  }
  invalidateCache();
  return problems.map((p) => p.id);
}

module.exports = {
  parseImportFile, normalizeProblem, validateImport, verifyProblem, insertProblems, isServiceError,
  buildJavaCall, javaStarter, PARAM_TYPES, RETURN_TYPES
};
