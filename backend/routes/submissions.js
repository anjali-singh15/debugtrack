const express = require('express');
const { all, get } = require('../database');
const { loadProblems, getProblem } = require('../services/problemService');
const { toDate } = require('../services/analyticsService');
const { HttpError } = require('../utils/http');

const router = express.Router();

const parse = (s, fallback) => {
  try { return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
};

function formatSubmission(row, problem, { includeCode = true } = {}) {
  return {
    id: row.id,
    problemId: row.problemId,
    problemTitle: problem ? problem.title : row.problemId,
    topic: problem ? problem.topic : null,
    difficulty: problem ? problem.difficulty : null,
    language: row.language,
    status: row.status,
    runtime: row.runtime,
    memory: row.memory,
    runtimeMs: row.runtimeMs,
    memoryKb: row.memoryKb,
    testCasesPassed: row.testCasesPassed,
    totalTestCases: row.totalTestCases,
    testResults: parse(row.testResults, []),
    analysis: row.mistakeCategory || row.ruleMatched ? {
      category: row.mistakeCategory,
      confidence: row.mistakeConfidence,
      ruleId: row.ruleMatched,
      explanation: row.feedback,
      suggestion: row.suggestion,
      evidence: parse(row.evidence, []),
      practiceTopic: row.practiceTopic
    } : null,
    // flat fields kept for compatibility with the Review-1 frontend
    mistakeCategory: row.mistakeCategory,
    ruleMatched: row.ruleMatched,
    feedback: row.feedback,
    suggestion: row.suggestion,
    code: includeCode ? row.code : undefined,
    timestamp: toDate(row.timestamp).toISOString()
  };
}

// GET /api/submissions?problemId=&status=&limit=
router.get('/', async (req, res) => {
  const where = ['userId = ?'];
  const params = [req.user.id];
  if (req.query.problemId) { where.push('problemId = ?'); params.push(String(req.query.problemId)); }
  if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);

  const [rows, problems] = await Promise.all([
    all(`SELECT * FROM submissions WHERE ${where.join(' AND ')} ORDER BY timestamp DESC, id DESC LIMIT ${limit}`, params),
    loadProblems()
  ]);
  const byId = Object.fromEntries(problems.map((p) => [p.id, p]));
  res.json(rows.map((r) => formatSubmission(r, byId[r.problemId])));
});

// GET /api/submissions/:id - only the owner can read a submission
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid submission id.');
  const row = await get('SELECT * FROM submissions WHERE id = ? AND userId = ?', [id, req.user.id]);
  // 404 (not 403) so other users' submission ids are not revealed
  if (!row) throw new HttpError(404, 'Submission not found.');
  res.json(formatSubmission(row, await getProblem(row.problemId)));
});

module.exports = router;
module.exports.formatSubmission = formatSubmission;
