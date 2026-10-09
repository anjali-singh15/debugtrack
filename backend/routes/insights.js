/**
 * Dashboard, analytics, mistake-pattern and recommendation endpoints.
 * All figures are computed from the logged-in user's submissions on every request.
 */
const express = require('express');
const { get } = require('../database');
const { loadProblems } = require('../services/problemService');
const { buildUserAnalytics } = require('../services/analyticsService');
const { recommendProblems } = require('../services/recommendationService');
const { RULES } = require('../mistakeEngine');
const { publicUser } = require('../utils/http');

const router = express.Router();

function weakArea(a) {
  const mf = a.mistakeSummary.mostFrequent;
  const wt = a.weakestTopic;
  if (!mf && !wt) return null;
  return {
    mistakeCategory: mf ? mf.name : null,
    mistakeCount: mf ? mf.count : 0,
    mistakeShare: mf ? mf.share : 0,
    tip: mf ? mf.tip : null,
    topic: wt ? wt.topic : (mf ? mf.practiceTopic : null),
    topicAccuracy: wt ? wt.accuracy : null,
    topicSubmissions: wt ? wt.submissions : 0,
    fixedAfterMistake: a.overview.fixedAfterMistake
  };
}

function notifications(a, recs) {
  const list = [];
  const mf = a.mistakeSummary.mostFrequent;
  if (mf) list.push({ id: 'mistake', icon: 'fa-solid fa-triangle-exclamation', iconColor: '#f43f5e', title: 'Most frequent mistake', message: `${mf.name} accounts for ${mf.count} of your flagged submissions.` });
  if (recs[0]) list.push({ id: 'rec', icon: 'fa-solid fa-bolt', iconColor: '#06b6d4', title: 'Recommended next', message: `${recs[0].title}: ${recs[0].reason}`, problemId: recs[0].problemId });
  if (a.improvement.mistakeRateChange != null && a.improvement.mistakeRateChange < 0) {
    list.push({ id: 'improve', icon: 'fa-solid fa-arrow-trend-down', iconColor: '#10b981', title: 'Fewer mistakes', message: `Your mistake rate dropped by ${-a.improvement.mistakeRateChange} points over the last 14 days.` });
  }
  if (a.streak >= 2) list.push({ id: 'streak', icon: 'fa-solid fa-fire', iconColor: '#f59e0b', title: 'Practice streak', message: `You have practised ${a.streak} days in a row.` });
  return list;
}

// GET /api/dashboard
router.get('/dashboard', async (req, res) => {
  const [a, problems] = await Promise.all([buildUserAnalytics(req.user.id), loadProblems()]);
  const recs = recommendProblems(a, problems, 4);
  res.json({
    overview: a.overview,
    streak: a.streak,
    weakArea: weakArea(a),
    mistakeSummary: a.mistakeSummary,
    categories: a.categories,
    recentSubmissions: a.recentSubmissions,
    recommendations: recs,
    weekly: a.weekly,
    improvement: a.improvement,
    notifications: notifications(a, recs)
  });
});

// GET /api/analytics
router.get('/analytics', async (req, res) => {
  const a = await buildUserAnalytics(req.user.id);
  res.json({
    overview: a.overview,
    streak: a.streak,
    categories: a.categories,
    mistakeSummary: a.mistakeSummary,
    topicStats: a.topicStats,
    weakestTopic: a.weakestTopic,
    weekly: a.weekly,
    improvement: a.improvement
  });
});

// GET /api/mistakes
router.get('/mistakes', async (req, res) => {
  const a = await buildUserAnalytics(req.user.id);
  res.json({
    mistakeSummary: a.mistakeSummary,
    categories: a.categories,
    weakestTopic: a.weakestTopic,
    weekly: a.weekly,
    improvement: a.improvement,
    history: a.mistakeHistory,
    totalSubmissions: a.overview.totalSubmissions,
    rules: RULES
  });
});

// GET /api/recommendations
router.get('/recommendations', async (req, res) => {
  const [a, problems] = await Promise.all([buildUserAnalytics(req.user.id), loadProblems()]);
  res.json(recommendProblems(a, problems, Math.min(parseInt(req.query.limit, 10) || 4, 10)));
});

// GET /api/data - Review-1 aggregate endpoint, kept for compatibility (now user-specific and data-driven)
router.get('/data', async (req, res) => {
  const [a, problems, user] = await Promise.all([
    buildUserAnalytics(req.user.id), loadProblems(), get('SELECT * FROM users WHERE id = ?', [req.user.id])
  ]);
  const recs = Object.fromEntries(recommendProblems(a, problems, 6).map((r) => [r.problemId, r.reason]));
  res.json({
    studentProfile: { ...publicUser(user), stats: { ...a.overview, currentStreak: a.streak } },
    problems: problems.map((p) => ({
      id: p.id, title: p.title, difficulty: p.difficulty, topic: p.topic,
      status: a.problemStates[p.id].status, recommended: !!recs[p.id], recommendedReason: recs[p.id] || null
    })),
    mistakeCategories: a.categories,
    weakestArea: weakArea(a),
    recentActivity: a.recentSubmissions,
    topicPerformance: a.topicStats,
    weeklyMistakes: a.weekly.map((w) => ({ week: w.label, count: w.mistakes })),
    problemsSolvedOverTime: a.weekly.map((w) => ({ label: w.label, solved: w.solvedCumulative, accuracy: w.accuracy }))
  });
});

module.exports = router;
