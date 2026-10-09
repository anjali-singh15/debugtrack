const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run } = require('../database');
const { HttpError, str, validatePassword, publicUser } = require('../utils/http');
const { buildUserAnalytics } = require('../services/analyticsService');
const { loadProblems } = require('../services/problemService');

const router = express.Router();

const { LANGUAGE_IDS } = require('../languages');

const DEFAULT_SETTINGS = { editorFontSize: 14, tabSize: 4, wordWrap: false, minimap: false, showDiagnostics: true, defaultLanguage: 'java' };

function readSettings(raw) {
  let parsed = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch (e) { parsed = {}; }
  return { ...DEFAULT_SETTINGS, ...parsed };
}

function buildAchievements(a, problems) {
  const solvedProblems = problems.filter((p) => a.solvedIds.has(p.id));
  const topicsTried = new Set(problems.filter((p) => a.attemptedIds.has(p.id)).map((p) => p.topic)).size;
  const solved = a.overview.problemsSolved;
  const item = (id, icon, title, description, value, target) => ({
    id, icon, title, description,
    unlocked: value >= target,
    progress: Math.min(100, Math.round((value / target) * 100))
  });
  return [
    item('first_solve', '✅', 'First Accepted', 'Get your first Accepted submission', solved, 1),
    item('solved_5', '🏆', '5 Problems Solved', 'Solve 5 different problems', solved, 5),
    item('solved_15', '🚀', '15 Problems Solved', 'Solve 15 different problems', solved, 15),
    item('first_medium', '⚡', 'Medium Challenger', 'Solve a Medium problem', solvedProblems.filter((p) => p.difficulty === 'Medium').length, 1),
    item('first_hard', '💎', 'Hard Problem Conqueror', 'Solve a Hard problem', solvedProblems.filter((p) => p.difficulty === 'Hard').length, 1),
    item('bug_fixer', '🧠', 'Bug Fixer', 'Solve 3 problems after a flagged mistake on them', a.overview.fixedAfterMistake, 3),
    item('streak_3', '🔥', '3-Day Streak', 'Practise on 3 consecutive days', a.streak, 3),
    item('explorer', '🧭', 'Topic Explorer', 'Attempt problems in 5 different topics', topicsTried, 5)
  ];
}

// GET /api/profile
router.get('/profile', async (req, res) => {
  const [user, analytics, problems, solvedCounts, userCount] = await Promise.all([
    get('SELECT * FROM users WHERE id = ?', [req.user.id]),
    buildUserAnalytics(req.user.id),
    loadProblems(),
    all(`SELECT userId, COUNT(DISTINCT problemId) AS solved FROM submissions WHERE status = 'Accepted' GROUP BY userId`),
    get('SELECT COUNT(*) AS n FROM users')
  ]);
  const mySolved = analytics.overview.problemsSolved;
  const rank = 1 + solvedCounts.filter((r) => r.solved > mySolved).length;

  res.json({
    user: publicUser(user),
    stats: {
      ...analytics.overview,
      currentStreak: analytics.streak,
      rank,
      totalUsers: userCount.n,
      weakestTopic: analytics.weakestTopic,
      mostFrequentMistake: analytics.mistakeSummary.mostFrequent,
      totalMistakes: analytics.mistakeSummary.totalMistakes
    },
    topicStats: analytics.topicStats,
    last7Days: analytics.last7Days,
    achievements: buildAchievements(analytics, problems),
    solvedProblems: problems.filter((p) => analytics.solvedIds.has(p.id))
      .map((p) => ({ id: p.id, number: p.number, title: p.title, difficulty: p.difficulty, topic: p.topic })),
    recentSubmissions: analytics.recentSubmissions
  });
});

// PUT /api/profile - name and university only; email/password have dedicated, validated flows
router.put('/profile', async (req, res) => {
  const name = str(req.body && req.body.name);
  const university = str(req.body && req.body.university);
  if (!name || name.length < 2 || name.length > 60) {
    throw new HttpError(400, 'Name must be between 2 and 60 characters.', { name: 'Name must be between 2 and 60 characters.' });
  }
  if (university.length > 100) {
    throw new HttpError(400, 'University must be at most 100 characters.', { university: 'Too long.' });
  }
  await run('UPDATE users SET name = ?, university = ? WHERE id = ?', [name, university || null, req.user.id]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
});

// PUT /api/profile/password
router.put('/profile/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new HttpError(400, 'All password fields are required.');
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
  }
  const pwError = validatePassword(newPassword);
  if (pwError) throw new HttpError(400, pwError, { newPassword: pwError });
  if (newPassword !== confirmPassword) throw new HttpError(400, 'New passwords do not match.', { confirmPassword: 'Passwords do not match.' });
  if (newPassword === currentPassword) throw new HttpError(400, 'New password must be different from the current one.', { newPassword: 'Choose a different password.' });

  await run('UPDATE users SET passwordHash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ ok: true });
});

// GET /api/settings
router.get('/settings', async (req, res) => {
  const user = await get('SELECT settings FROM users WHERE id = ?', [req.user.id]);
  res.json({ settings: readSettings(user && user.settings) });
});

// PUT /api/settings - whitelisted, validated keys only
router.put('/settings', async (req, res) => {
  const body = req.body || {};
  const user = await get('SELECT settings FROM users WHERE id = ?', [req.user.id]);
  const settings = readSettings(user && user.settings);

  if (body.editorFontSize !== undefined) {
    const v = Number(body.editorFontSize);
    if (![12, 13, 14, 15, 16, 18].includes(v)) throw new HttpError(400, 'Editor font size must be one of 12, 13, 14, 15, 16 or 18.');
    settings.editorFontSize = v;
  }
  if (body.tabSize !== undefined) {
    const v = Number(body.tabSize);
    if (![2, 4].includes(v)) throw new HttpError(400, 'Tab size must be 2 or 4.');
    settings.tabSize = v;
  }
  if (body.defaultLanguage !== undefined) {
    if (!LANGUAGE_IDS.includes(body.defaultLanguage)) throw new HttpError(400, `Default language must be one of: ${LANGUAGE_IDS.join(', ')}.`);
    settings.defaultLanguage = body.defaultLanguage;
  }
  ['wordWrap', 'minimap', 'showDiagnostics'].forEach((k) => {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'boolean') throw new HttpError(400, `${k} must be true or false.`);
      settings[k] = body[k];
    }
  });

  await run('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(settings), req.user.id]);
  res.json({ settings });
});

module.exports = router;
module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
