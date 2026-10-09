const express = require('express');
const { all } = require('../database');
const { loadProblems, getProblem, toSummary, toDetail, TOPICS } = require('../services/problemService');
const { buildUserAnalytics, getGlobalAcceptance } = require('../services/analyticsService');
const { recommendProblems } = require('../services/recommendationService');
const { HttpError } = require('../utils/http');
const { formatSubmission } = require('./submissions');

const router = express.Router();

// GET /api/problems - catalogue with the current user's status and recommendations
router.get('/', async (req, res) => {
  const [problems, analytics, acceptance] = await Promise.all([
    loadProblems(), buildUserAnalytics(req.user.id), getGlobalAcceptance()
  ]);
  const recommended = Object.fromEntries(recommendProblems(analytics, problems, 6).map((r) => [r.problemId, r.reason]));

  res.json({
    topics: TOPICS,
    difficulties: ['Easy', 'Medium', 'Hard'],
    problems: problems.map((p) => ({
      ...toSummary(p),
      status: analytics.problemStates[p.id].status,
      attempts: analytics.problemStates[p.id].attempts,
      acceptanceRate: acceptance[p.id] ? acceptance[p.id].rate : null,
      totalSubmissions: acceptance[p.id] ? acceptance[p.id].total : 0,
      recommended: !!recommended[p.id],
      recommendedReason: recommended[p.id] || null
    }))
  });
});

// GET /api/problems/:id - public detail (sample tests only, never hidden tests)
router.get('/:id', async (req, res) => {
  const problem = await getProblem(req.params.id);
  if (!problem) throw new HttpError(404, 'Problem not found.');

  const [analytics, acceptance, problems] = await Promise.all([
    buildUserAnalytics(req.user.id), getGlobalAcceptance(), loadProblems()
  ]);
  const rec = recommendProblems(analytics, problems, 6).find((r) => r.problemId === problem.id);

  res.json({
    ...toDetail(problem),
    status: analytics.problemStates[problem.id].status,
    attempts: analytics.problemStates[problem.id].attempts,
    acceptanceRate: acceptance[problem.id] ? acceptance[problem.id].rate : null,
    recommendedReason: rec ? rec.reason : null
  });
});

// GET /api/problems/:id/submissions - the current user's previous attempts on this problem
router.get('/:id/submissions', async (req, res) => {
  const problem = await getProblem(req.params.id);
  if (!problem) throw new HttpError(404, 'Problem not found.');
  const rows = await all(
    'SELECT * FROM submissions WHERE userId = ? AND problemId = ? ORDER BY timestamp DESC, id DESC',
    [req.user.id, problem.id]
  );
  res.json(rows.map((r) => formatSubmission(r, problem)));
});

module.exports = router;
