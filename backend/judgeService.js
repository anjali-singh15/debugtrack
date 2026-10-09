/**
 * DebugTrack - Judge0 Code Execution Service (Java, Python, C++)
 *
 * Student code is NEVER executed inside this Node.js process. It is wrapped in a small
 * language-specific test harness (see languages/) and sent to a sandboxed Judge0 CE instance.
 *
 * All harnesses print the same protocol, parsed here:
 *   ---TC_<id>---                          start of a test case
 *   @@RESULT@@<formatted value>            the method's result
 *   @@ERROR@@<type>@@<line>@@<message>     an exception caught inside the test
 *   @@CRASH@@<signal>                      (C++) the test's child process was killed by a signal
 * Any other line inside a test block is the student's own printed output.
 */
const { getLanguage } = require('./languages');

const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_POLLS = 15;

class ExecutionServiceError extends Error {
  constructor(message, httpStatus = 503) {
    super(message);
    this.name = 'ExecutionServiceError';
    this.httpStatus = httpStatus;
  }
}

const b64 = (s) => Buffer.from(s || '', 'utf8').toString('base64');
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

async function judgeFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
    headers['X-Auth-Token'] = JUDGE0_API_KEY;
  }
  let response;
  try {
    response = await fetch(`${JUDGE0_URL}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ExecutionServiceError('The code execution service took too long to respond. Please try again.', 504);
    }
    throw new ExecutionServiceError('The code execution service (Judge0) is unreachable. Check your internet connection and try again.', 503);
  }

  if (response.status === 429) {
    throw new ExecutionServiceError('The code execution service is busy (rate limited). Please wait a few seconds and try again.', 503);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`Judge0 HTTP ${response.status}: ${body.slice(0, 300)}`);
    throw new ExecutionServiceError('The code execution service returned an error. Please try again shortly.', 502);
  }
  return response.json();
}

async function submitToJudge0(sourceCode, languageId) {
  const fields = 'stdout,stderr,compile_output,message,status,time,memory,token';
  let result = await judgeFetch(`/submissions?base64_encoded=true&wait=true&fields=${fields}`, {
    method: 'POST',
    body: JSON.stringify({
      language_id: languageId,
      source_code: b64(sourceCode),
      cpu_time_limit: 2,
      wall_time_limit: 6,
      memory_limit: 256000
    })
  });

  // Some Judge0 deployments ignore wait=true; fall back to polling the token.
  let polls = 0;
  while (result && result.status && result.status.id <= 2 && result.token && polls < MAX_POLLS) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await judgeFetch(`/submissions/${result.token}?base64_encoded=true&fields=${fields}`);
    polls++;
  }
  if (!result || !result.status || result.status.id <= 2) {
    throw new ExecutionServiceError('Your code is still queued on the execution service. Please try again.', 504);
  }

  return {
    statusId: result.status.id,
    statusDesc: result.status.description,
    stdout: unb64(result.stdout),
    stderr: unb64(result.stderr),
    compileOutput: unb64(result.compile_output),
    message: unb64(result.message),
    time: result.time ? parseFloat(result.time) : null,
    memory: result.memory || null
  };
}

/** Normalises formatting so "[0,1]" and "[0, 1]" compare equal, without touching spacing inside quoted strings. */
function normalizeOutput(s) {
  return String(s == null ? '' : s).trim().replace(/\s*([,\[\]])\s*/g, '$1');
}

function outputsMatch(actual, expected, compare) {
  if (actual === undefined) return false;
  if (compare === 'unordered') {
    const sortInner = (v) => {
      const n = normalizeOutput(v);
      if (!/^\[.*\]$/.test(n)) return n;
      return '[' + n.slice(1, -1).split(',').filter(Boolean).sort().join(',') + ']';
    };
    return sortInner(actual) === sortInner(expected);
  }
  return normalizeOutput(actual) === normalizeOutput(expected);
}

function parseHarnessOutput(stdout, tests, lang) {
  const language = lang || getLanguage('java');
  const byId = {};
  tests.forEach((tc) => { byId[tc.id] = { started: false, actual: undefined, error: null, stdout: [] }; });
  let current = null;

  for (const line of stdout.split('\n')) {
    const marker = line.match(/^---TC_(\d+)---$/);
    if (marker) {
      current = byId[marker[1]] || null;
      if (current) current.started = true;
      continue;
    }
    if (!current) continue;

    const r = line.indexOf('@@RESULT@@');
    if (r !== -1) {
      if (r > 0) current.stdout.push(line.slice(0, r));
      current.actual = line.slice(r + '@@RESULT@@'.length);
      continue;
    }
    const e = line.indexOf('@@ERROR@@');
    if (e !== -1) {
      if (e > 0) current.stdout.push(line.slice(0, e));
      const [type, lineNo, ...msg] = line.slice(e + '@@ERROR@@'.length).split('@@');
      const shortType = language.id === 'java' ? type.split('.').pop() : type;
      const message = msg.join('@@');
      current.error = {
        type: shortType,
        fullType: type,
        kind: language.errorKind(shortType, message),
        line: Number(lineNo) > 0 ? Number(lineNo) : null,
        message
      };
      continue;
    }
    const c = line.match(/^@@CRASH@@(\d+)$/);
    if (c && language.crashError) {
      const crash = language.crashError(Number(c[1]), current.stdout);
      current.error = crash.error;
      current.stdout = crash.stdout;
      continue;
    }
    if (current.stdout.length < 50) current.stdout.push(line);
  }
  return byId;
}

/** Rewrites "<file>:57:" into "Line 3:" relative to the student's code. */
function mapCompilerOutput(text, userStart, userEnd, sourceFile = 'Main.java') {
  const re = new RegExp(sourceFile.replace('.', '\\.') + ':(\\d+):', 'g');
  return (text || '').replace(re, (m, n) => {
    const line = Number(n);
    if (line >= userStart && line <= userEnd) return `Line ${line - userStart + 1}:`;
    return 'Test harness:';
  }).trim();
}

/**
 * Runs the student's code against the problem's test cases on Judge0.
 * @param {string} code      Student's source code
 * @param {object} problem   Problem record including full `tests` and `signature`
 * @param {object} options   { language: 'java' | 'python' | 'cpp', includeHidden: boolean }
 */
async function executeCode(code, problem, { language = 'java', includeHidden = false } = {}) {
  const lang = getLanguage(language);
  if (!lang) throw new Error(`Unsupported language: ${language}`);
  const tests = includeHidden ? problem.tests : problem.tests.filter((tc) => !tc.hidden);
  const { source, userStart, userEnd } = lang.buildHarness(code, tests, problem.signature);
  const judge = await submitToJudge0(source, lang.judgeId);

  if (judge.statusId === 13 || judge.statusId === 14) {
    console.error('Judge0 internal error:', judge.message);
    throw new ExecutionServiceError('The code execution service had an internal error. Please try again.', 502);
  }

  const runtimeMs = judge.time != null ? Math.round(judge.time * 1000) : null;
  const memoryKb = judge.memory;
  const base = {
    language,
    runtimeMs,
    memoryKb,
    runtime: runtimeMs != null ? `${runtimeMs} ms` : 'N/A',
    memory: memoryKb ? `${(memoryKb / 1024).toFixed(1)} MB` : 'N/A',
    judgeStatus: judge.statusDesc,
    testsTotal: tests.length
  };

  const compileOutput = judge.statusId === 6
    ? mapCompilerOutput(judge.compileOutput, userStart, userEnd, lang.sourceFile)
    : (lang.detectCompileError ? lang.detectCompileError(judge, userStart, userEnd) : null);
  if (compileOutput) {
    return {
      ...base,
      verdict: 'Compilation Error',
      passed: false,
      testsPassed: 0,
      tests: tests.map((tc) => ({ id: tc.id, input: tc.input, expected: tc.expected, hidden: tc.hidden, edge: tc.edge || null, passed: false, status: 'Not Run' })),
      compileOutput,
      stderr: ''
    };
  }

  const timedOut = judge.statusId === 5;
  const crashed = judge.statusId >= 7 && judge.statusId <= 12;
  const parsed = parseHarnessOutput(judge.stdout, tests, lang);

  const results = tests.map((tc) => {
    const p = parsed[tc.id];
    const r = {
      id: tc.id, input: tc.input, expected: tc.expected, hidden: tc.hidden, edge: tc.edge || null,
      actual: p.actual, stdout: p.stdout.join('\n').slice(0, 2000), error: p.error, passed: false
    };
    if (p.error) {
      r.status = 'Runtime Error';
      r.actual = `${p.error.type}${p.error.message && p.error.message !== 'null' ? ': ' + p.error.message : ''}`;
    } else if (p.actual !== undefined) {
      r.passed = outputsMatch(p.actual, tc.expected, tc.compare);
      r.status = r.passed ? 'Passed' : 'Wrong Answer';
    } else if (p.started && timedOut) {
      r.status = 'Time Limit Exceeded';
      r.actual = 'Time limit exceeded while running this test';
    } else if (p.started && crashed) {
      r.status = 'Runtime Error';
      r.actual = 'Program terminated abnormally';
    } else {
      r.status = 'Not Run';
      r.actual = timedOut ? 'Not run (time limit reached earlier)' : 'Not run (execution stopped earlier)';
    }
    return r;
  });

  const firstFailure = results.find((r) => !r.passed);
  let verdict = 'Accepted';
  if (firstFailure) {
    if (firstFailure.status === 'Runtime Error') verdict = 'Runtime Error';
    else if (firstFailure.status === 'Wrong Answer') verdict = 'Wrong Answer';
    else if (timedOut) verdict = 'Time Limit Exceeded';
    else verdict = 'Runtime Error';
  } else if (timedOut) {
    verdict = 'Time Limit Exceeded';
  } else if (crashed) {
    verdict = 'Runtime Error';
  }

  return {
    ...base,
    verdict,
    passed: verdict === 'Accepted',
    testsPassed: results.filter((r) => r.passed).length,
    tests: results,
    compileOutput: '',
    stderr: mapCompilerOutput(judge.stderr, userStart, userEnd, lang.sourceFile).slice(0, 2000)
  };
}

/** Kept for compatibility with Review-1 callers. */
const executeJavaCode = (code, problem, options = {}) => executeCode(code, problem, { ...options, language: 'java' });

module.exports = {
  executeCode,
  executeJavaCode,
  ExecutionServiceError,
  // exported for unit tests
  buildHarness: (code, tests, sig) => getLanguage('java').buildHarness(code, tests, sig),
  parseHarnessOutput,
  outputsMatch,
  normalizeOutput
};
