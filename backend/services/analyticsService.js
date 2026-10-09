/**
 * Analytics derived on demand from the submissions table (never cached in the database).
 * Every number here belongs to exactly one user.
 */
const { all } = require('../database');
const { loadProblems, TOPICS } = require('./problemService');
const { CATEGORIES, CATEGORY_INFO } = require('../mistakeEngine');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 8;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Accepts ISO strings and the older "YYYY-MM-DD HH:MM:SS" (UTC) SQLite format. */
function toDate(ts) {
  if (!ts) return new Date(0);
  const s = String(ts);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
}

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

async function getGlobalAcceptance() {
  const rows = await all(`SELECT problemId, COUNT(*) AS total, SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) AS accepted
                          FROM submissions GROUP BY problemId`);
  const map = {};
  rows.forEach((r) => { map[r.problemId] = { total: r.total, accepted: r.accepted, rate: pct(r.accepted, r.total) }; });
  return map;
}

async function buildUserAnalytics(userId) {
  const [subs, problems] = await Promise.all([
    all(`SELECT id, problemId, status, runtime, memory, runtimeMs, memoryKb, testCasesPassed, totalTestCases,
                mistakeCategory, mistakeConfidence, ruleMatched, feedback, practiceTopic, timestamp
         FROM submissions WHERE userId = ? ORDER BY timestamp ASC, id ASC`, [userId]),
    loadProblems()
  ]);
  const problemById = Object.fromEntries(problems.map((p) => [p.id, p]));
  subs.forEach((s) => { s.date = toDate(s.timestamp); s.problem = problemById[s.problemId] || null; });

  // ---------------------------------------------------------------- overview
  const accepted = subs.filter((s) => s.status === 'Accepted');
  const firstSolvedAt = {};
  const attemptsByProblem = {};
  subs.forEach((s) => {
    attemptsByProblem[s.problemId] = (attemptsByProblem[s.problemId] || 0) + 1;
    if (s.status === 'Accepted' && !firstSolvedAt[s.problemId]) firstSolvedAt[s.problemId] = s.date;
  });
  const solvedIds = new Set(Object.keys(firstSolvedAt));
  const attemptedIds = new Set(Object.keys(attemptsByProblem));
  const runtimes = accepted.map((s) => s.runtimeMs).filter((v) => typeof v === 'number');

  const overview = {
    problemsAttempted: attemptedIds.size,
    problemsSolved: solvedIds.size,
    totalProblems: problems.length,
    totalSubmissions: subs.length,
    acceptedSubmissions: accepted.length,
    failedSubmissions: subs.length - accepted.length,
    accuracy: pct(accepted.length, subs.length) || 0,
    averageRuntimeMs: runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : null,
    // problems eventually solved after at least one flagged mistake on them
    fixedAfterMistake: [...solvedIds].filter((id) =>
      subs.some((s) => s.problemId === id && s.mistakeCategory && s.date < firstSolvedAt[id])).length
  };

  const problemStates = {};
  problems.forEach((p) => {
    problemStates[p.id] = {
      status: solvedIds.has(p.id) ? 'Solved' : attemptedIds.has(p.id) ? 'Attempted' : 'Not Started',
      attempts: attemptsByProblem[p.id] || 0
    };
  });

  // ---------------------------------------------------------------- mistakes
  const mistakeSubs = subs.filter((s) => s.mistakeCategory);
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, { total: 0, possible: 0, lastAt: null }]));
  mistakeSubs.forEach((s) => {
    const c = counts[s.mistakeCategory];
    if (!c) return;
    c.total++;
    if (s.mistakeConfidence === 'possible') c.possible++;
    c.lastAt = s.date;
  });
  const categories = CATEGORIES.map((name) => ({
    name,
    count: counts[name].total,
    possibleCount: counts[name].possible,
    share: pct(counts[name].total, mistakeSubs.length) || 0,
    lastSeen: counts[name].lastAt ? counts[name].lastAt.toISOString() : null,
    ...CATEGORY_INFO[name]
  }));
  // Most frequent named pattern; ties broken by most recent occurrence. Unclassified is only used if nothing else exists.
  const ranked = categories.filter((c) => c.count > 0)
    .sort((a, b) => (a.name === 'Unclassified') - (b.name === 'Unclassified') || b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen)));
  const mostFrequent = ranked[0] || null;

  // ---------------------------------------------------------------- topics
  const topicStats = TOPICS.map((topic) => {
    const tp = problems.filter((p) => p.topic === topic);
    const ts = subs.filter((s) => s.problem && s.problem.topic === topic);
    const acc = ts.filter((s) => s.status === 'Accepted').length;
    const accuracy = pct(acc, ts.length);
    let status = 'Not Started';
    if (ts.length) status = accuracy >= 80 ? 'Strong' : accuracy >= 60 ? 'Good' : accuracy >= 40 ? 'Improving' : 'Needs Practice';
    return {
      topic,
      totalProblems: tp.length,
      solved: tp.filter((p) => solvedIds.has(p.id)).length,
      attempted: tp.filter((p) => attemptedIds.has(p.id)).length,
      submissions: ts.length,
      accepted: acc,
      accuracy,
      mistakes: ts.filter((s) => s.mistakeCategory).length,
      status
    };
  });
  // Weakest topic = lowest accuracy. A single attempt is weak evidence, so topics with
  // at least 2 submissions are preferred whenever any exist.
  const imperfect = topicStats.filter((t) => t.submissions > 0 && t.accuracy < 100);
  const wellSampled = imperfect.filter((t) => t.submissions >= 2);
  const weakestTopic = (wellSampled.length ? wellSampled : imperfect)
    .sort((a, b) => a.accuracy - b.accuracy || b.mistakes - a.mistakes || b.submissions - a.submissions)[0] || null;

  // ---------------------------------------------------------------- time series (rolling 7-day windows)
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekly = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const end = new Date(todayStart.getTime() + DAY_MS - w * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const inWeek = subs.filter((s) => s.date >= start && s.date < end);
    const acc = inWeek.filter((s) => s.status === 'Accepted').length;
    const mistakes = inWeek.filter((s) => s.mistakeCategory).length;
    weekly.push({
      label: `${MONTHS[start.getMonth()]} ${start.getDate()}`,
      start: start.toISOString(),
      submissions: inWeek.length,
      accepted: acc,
      mistakes,
      accuracy: pct(acc, inWeek.length),
      mistakeRate: pct(mistakes, inWeek.length),
      solvedCumulative: Object.values(firstSolvedAt).filter((d) => d < end).length,
      byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, inWeek.filter((s) => s.mistakeCategory === c).length]))
    });
  }

  // Improvement: mistake rate in the last 14 days vs. the 14 days before that
  const recentWindow = subs.filter((s) => s.date >= new Date(now - 14 * DAY_MS));
  const previousWindow = subs.filter((s) => s.date >= new Date(now - 28 * DAY_MS) && s.date < new Date(now - 14 * DAY_MS));
  const rate = (list) => pct(list.filter((s) => s.mistakeCategory).length, list.length);
  const improvement = {
    recentMistakeRate: rate(recentWindow),
    previousMistakeRate: rate(previousWindow),
    recentAccuracy: pct(recentWindow.filter((s) => s.status === 'Accepted').length, recentWindow.length),
    previousAccuracy: pct(previousWindow.filter((s) => s.status === 'Accepted').length, previousWindow.length)
  };
  improvement.mistakeRateChange = (improvement.recentMistakeRate != null && improvement.previousMistakeRate != null)
    ? improvement.recentMistakeRate - improvement.previousMistakeRate : null;
  improvement.accuracyChange = (improvement.recentAccuracy != null && improvement.previousAccuracy != null)
    ? improvement.recentAccuracy - improvement.previousAccuracy : null;

  // Daily activity for the last 7 days and the current streak
  const perDay = {};
  subs.forEach((s) => { const k = dayKey(s.date); perDay[k] = (perDay[k] || 0) + 1; });
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * DAY_MS);
    last7Days.push({ day: WEEKDAYS[d.getDay()], date: d.toISOString(), count: perDay[dayKey(d)] || 0 });
  }
  let streak = 0;
  let cursor = perDay[dayKey(todayStart)] ? todayStart : new Date(todayStart.getTime() - DAY_MS);
  while (perDay[dayKey(cursor)]) { streak++; cursor = new Date(cursor.getTime() - DAY_MS); }

  // ---------------------------------------------------------------- lists
  const describe = (s) => ({
    id: s.id,
    problemId: s.problemId,
    problemTitle: s.problem ? s.problem.title : s.problemId,
    topic: s.problem ? s.problem.topic : null,
    difficulty: s.problem ? s.problem.difficulty : null,
    status: s.status,
    runtime: s.runtime,
    memory: s.memory,
    testCasesPassed: s.testCasesPassed,
    totalTestCases: s.totalTestCases,
    mistakeCategory: s.mistakeCategory,
    mistakeConfidence: s.mistakeConfidence,
    ruleMatched: s.ruleMatched,
    feedback: s.feedback,
    timestamp: s.date.toISOString()
  });
  const newestFirst = [...subs].reverse();

  return {
    overview,
    streak,
    problemStates,
    solvedIds,
    attemptedIds,
    attemptsByProblem,
    categories,
    mistakeSummary: {
      totalMistakes: mistakeSubs.length,
      possibleMistakes: mistakeSubs.filter((s) => s.mistakeConfidence === 'possible').length,
      mostFrequent: mostFrequent ? { name: mostFrequent.name, count: mostFrequent.count, share: mostFrequent.share, tip: mostFrequent.tip, practiceTopic: mostFrequent.practiceTopic } : null
    },
    recentMistakeCategories: newestFirst.filter((s) => s.mistakeCategory && s.mistakeCategory !== 'Unclassified').slice(0, 15).map((s) => s.mistakeCategory),
    topicStats,
    weakestTopic,
    weekly,
    improvement,
    last7Days,
    recentSubmissions: newestFirst.slice(0, 8).map(describe),
    mistakeHistory: newestFirst.filter((s) => s.mistakeCategory).slice(0, 25).map(describe)
  };
}

module.exports = { buildUserAnalytics, getGlobalAcceptance, toDate };
