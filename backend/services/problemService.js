/**
 * Problem catalogue access. Problems are read-only at runtime, so they are cached in memory.
 * Hidden test cases and reference solutions never leave this module through the public mappers.
 */
const { all } = require('../database');
const { starterCodes, LANGUAGE_LIST } = require('../languages');

const TOPICS = ['Arrays', 'Strings', 'Hashing', 'Searching', 'Sorting', 'Linked List', 'Stack', 'Queue', 'Trees', 'Graphs', 'Dynamic Programming'];
const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

let cache = null;

const parse = (s, fallback) => {
  try { return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
};

async function loadProblems() {
  if (cache) return cache;
  const rows = await all('SELECT * FROM problems ORDER BY number, id');
  cache = rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    difficulty: r.difficulty,
    topic: r.topic,
    focus: parse(r.focus, []),
    signature: parse(r.signature, null),
    mistakeProneArea: r.mistakeProneArea || '',
    description: r.description || '',
    examples: parse(r.examples, []),
    constraints: parse(r.constraints, []),
    hints: parse(r.hints, []),
    starterCode: r.starterCode || '',
    tests: parse(r.testCases, [])
  }));
  cache.forEach((p) => { p.starterCodes = starterCodes(p); });
  return cache;
}

function invalidateCache() {
  cache = null;
}

async function getProblem(id) {
  return (await loadProblems()).find((p) => p.id === id) || null;
}

function toSummary(p) {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    difficulty: p.difficulty,
    topic: p.topic,
    focus: p.focus,
    mistakeProneArea: p.mistakeProneArea
  };
}

function toDetail(p) {
  return {
    ...toSummary(p),
    description: p.description,
    examples: p.examples,
    constraints: p.constraints,
    hints: p.hints,
    starterCode: p.starterCode,
    starterCodes: p.starterCodes,
    languages: LANGUAGE_LIST,
    sampleTests: p.tests.filter((t) => !t.hidden).map((t) => ({ id: t.id, input: t.input, expected: t.expected })),
    hiddenTestCount: p.tests.filter((t) => t.hidden).length
  };
}

module.exports = { TOPICS, DIFFICULTY_ORDER, loadProblems, getProblem, invalidateCache, toSummary, toDetail };
