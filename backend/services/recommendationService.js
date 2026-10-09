/**
 * Rule-based recommendation engine (no AI).
 *
 * Rules, applied to every problem the student has NOT solved yet:
 *   R1  recurring mistake  - problem trains the student's most frequent recent mistake category
 *   R2  secondary mistake  - problem trains the second most frequent recent category
 *   R3  weak topic         - problem belongs to the student's weakest topic (lowest accuracy)
 *   R4  unfinished attempt - student attempted the problem but has not solved it
 *   R5  new student / gap  - no history yet (or nothing else matched): Easy problems from untried topics
 * Each matching rule adds to a score and contributes a human-readable reason.
 */
const { DIFFICULTY_ORDER } = require('./problemService');

const MAX_PER_TOPIC = 2;

function rankCategories(recent) {
  const counts = {};
  recent.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function recommendProblems(analytics, problems, limit = 4) {
  const { solvedIds, attemptsByProblem, weakestTopic, overview } = analytics;
  const ranked = rankCategories(analytics.recentMistakeCategories || []);
  const primary = ranked[0] || null;
  const secondary = ranked[1] || null;
  const attemptedTopics = new Set(problems.filter((p) => attemptsByProblem[p.id]).map((p) => p.topic));

  const scored = problems
    .filter((p) => !solvedIds.has(p.id))
    .map((p) => {
      let score = 0;
      const reasons = [];
      if (primary && p.focus.includes(primary.name)) {
        score += 4 + Math.min(primary.count, 5);
        reasons.push({ rule: 'R1', text: `Recommended because you have recently made ${primary.count} ${primary.name} mistake${primary.count > 1 ? 's' : ''}; this problem practises ${p.mistakeProneArea.toLowerCase()}.` });
      }
      if (secondary && p.focus.includes(secondary.name)) {
        score += 2;
        reasons.push({ rule: 'R2', text: `Also targets ${secondary.name}, your next most frequent mistake (${secondary.count}).` });
      }
      if (weakestTopic && p.topic === weakestTopic.topic) {
        score += 3;
        reasons.push({ rule: 'R3', text: `${p.topic} is your weakest topic (${weakestTopic.accuracy}% accuracy over ${weakestTopic.submissions} submission${weakestTopic.submissions > 1 ? 's' : ''}).` });
      }
      const attempts = attemptsByProblem[p.id] || 0;
      if (attempts > 0) {
        score += 2;
        reasons.push({ rule: 'R4', text: `You attempted this problem ${attempts} time${attempts > 1 ? 's' : ''} but have not solved it yet.` });
      }
      if (overview.totalSubmissions === 0 || (!reasons.length && !attemptedTopics.has(p.topic))) {
        if (p.difficulty === 'Easy') {
          score += overview.totalSubmissions === 0 ? 1 : 0.5;
          reasons.push({ rule: 'R5', text: overview.totalSubmissions === 0
            ? `Good starting point: an Easy ${p.topic} problem to build your baseline.`
            : `Explore a new topic: you have not attempted any ${p.topic} problems yet.` });
        }
      }
      // Keep Hard problems out of the way while accuracy is low
      if (p.difficulty === 'Hard' && overview.accuracy < 50) score -= 2;
      return { problem: p, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score
      || DIFFICULTY_ORDER[a.problem.difficulty] - DIFFICULTY_ORDER[b.problem.difficulty]
      || a.problem.number - b.problem.number);

  const picked = [];
  const perTopic = {};
  for (const r of scored) {
    if (picked.length >= limit) break;
    if ((perTopic[r.problem.topic] || 0) >= MAX_PER_TOPIC) continue;
    perTopic[r.problem.topic] = (perTopic[r.problem.topic] || 0) + 1;
    picked.push(r);
  }

  return picked.map((r) => ({
    problemId: r.problem.id,
    number: r.problem.number,
    title: r.problem.title,
    difficulty: r.problem.difficulty,
    topic: r.problem.topic,
    focus: r.problem.focus,
    description: r.problem.description,
    score: r.score,
    reason: r.reasons[0].text,
    reasons: r.reasons
  }));
}

module.exports = { recommendProblems };
