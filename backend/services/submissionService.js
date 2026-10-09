/**
 * Run / Submit pipeline:
 *   validate -> Judge0 execution -> rule-based mistake analysis -> (submit only) persist -> client response
 */
const { run } = require('../database');
const { getProblem } = require('./problemService');
const { executeCode } = require('../judgeService');
const { getLanguage, LANGUAGE_IDS } = require('../languages');
const { analyzeSubmission } = require('../mistakeEngine');
const { HttpError, MAX_CODE_LENGTH } = require('../utils/http');

/**
 * Hidden tests are summarised for the client: only the first failing hidden test is revealed
 * (input / expected / actual), the others show pass/fail only. Visible tests are shown in full.
 */
function sanitizeTests(tests) {
  const firstHiddenFailure = tests.find((t) => t.hidden && !t.passed);
  return tests.map((t) => {
    if (t.hidden && t !== firstHiddenFailure) {
      return { id: t.id, hidden: true, passed: t.passed, status: t.status };
    }
    return {
      id: t.id,
      hidden: t.hidden,
      revealed: t.hidden || undefined,
      input: t.input,
      expected: t.expected,
      actual: t.actual,
      passed: t.passed,
      status: t.status,
      edge: t.edge,
      stdout: t.hidden ? undefined : (t.stdout || undefined),
      errorLine: t.error ? t.error.line : undefined
    };
  });
}

function validateRequest(body) {
  const problemId = body && typeof body.problemId === 'string' ? body.problemId.trim() : '';
  const code = body && typeof body.code === 'string' ? body.code : '';
  const language = (body && body.language) || 'java';
  if (!problemId) throw new HttpError(400, 'problemId is required.');
  if (!getLanguage(language)) throw new HttpError(400, `Unsupported language. Choose one of: ${LANGUAGE_IDS.join(', ')}.`);
  if (!code.trim()) throw new HttpError(400, 'Code cannot be empty. Write your solution before running it.');
  if (code.length > MAX_CODE_LENGTH) throw new HttpError(413, `Code is too long (max ${MAX_CODE_LENGTH / 1000} KB).`);
  return { problemId, code, language };
}

async function evaluate(userId, body, { mode, timestamp } = {}) {
  const { problemId, code, language } = validateRequest(body);
  const problem = await getProblem(problemId);
  if (!problem) throw new HttpError(404, 'Problem not found.');

  const isSubmit = mode === 'submit';
  const execution = await executeCode(code, problem, { language, includeHidden: isSubmit });
  const analysis = analyzeSubmission({ code, problem, execution, language });
  const tests = sanitizeTests(execution.tests);

  const response = {
    mode,
    problemId,
    language,
    status: execution.verdict,
    passed: execution.passed,
    runtime: execution.runtime,
    memory: execution.memory,
    runtimeMs: execution.runtimeMs,
    memoryKb: execution.memoryKb,
    testCasesPassed: execution.testsPassed,
    totalTestCases: execution.testsTotal,
    testResults: tests,
    compileOutput: execution.compileOutput || null,
    stderr: execution.stderr || null,
    analysis,
    // flat fields kept for compatibility with the Review-1 frontend
    mistakeCategory: analysis ? analysis.category : null,
    ruleMatched: analysis ? analysis.ruleId : null,
    feedback: analysis ? analysis.explanation : (execution.passed ? 'All test cases passed.' : null),
    suggestion: analysis ? analysis.suggestion : null
  };

  if (isSubmit) {
    const { lastID } = await run(
      `INSERT INTO submissions (userId, problemId, code, language, status, runtime, memory, runtimeMs, memoryKb,
         testCasesPassed, totalTestCases, testResults, mistakeCategory, mistakeConfidence, ruleMatched,
         feedback, suggestion, evidence, practiceTopic, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, problemId, code, language, execution.verdict, execution.runtime, execution.memory,
        execution.runtimeMs, execution.memoryKb, execution.testsPassed, execution.testsTotal, JSON.stringify(tests),
        analysis ? analysis.category : null,
        analysis ? analysis.confidence : null,
        analysis ? analysis.ruleId : null,
        analysis ? analysis.explanation : null,
        analysis ? analysis.suggestion : null,
        analysis ? JSON.stringify(analysis.evidence) : null,
        analysis ? analysis.practiceTopic : null,
        timestamp || new Date().toISOString()
      ]
    );
    response.submissionId = lastID;
  }
  return response;
}

module.exports = { evaluate, sanitizeTests };
