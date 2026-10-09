/**
 * Verifies the problem bank and the language harnesses against Judge0:
 *   - every reference solution (Java for all problems; Python + C++ for a subset covering every
 *     parameter/return type) must be Accepted on ALL tests (sample + hidden);
 *   - with --starter, every generated starter template must compile/run in every language
 *     (expected to fail tests, but never a Compilation Error).
 *
 * Usage: node scripts/verifyProblems.js [--starter] [--lang=java,python,cpp] [problemId ...]
 */
const { PROBLEMS } = require('../data/problems');
const REFERENCES = require('../data/referenceSolutions');
const { executeCode } = require('../judgeService');
const { starterCodes, LANGUAGE_IDS } = require('../languages');

const args = process.argv.slice(2);
const checkStarter = args.includes('--starter');
const langArg = args.find((a) => a.startsWith('--lang='));
const langs = langArg ? langArg.slice(7).split(',') : LANGUAGE_IDS;
const only = args.filter((a) => !a.startsWith('--'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(label, code, problem, language, includeHidden, expectAccepted) {
  const r = await executeCode(code, problem, { language, includeHidden });
  const ok = expectAccepted ? r.verdict === 'Accepted' : r.verdict !== 'Compilation Error';
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${String(problem.number).padEnd(3)} ${problem.id.padEnd(26)} ${language.padEnd(6)} ${label}: ${r.verdict} (${r.testsPassed}/${r.testsTotal}) ${r.runtime}`);
  if (!ok) {
    if (r.compileOutput) console.log(r.compileOutput.slice(0, 1500));
    r.tests.filter((t) => !t.passed).slice(0, 3).forEach((t) => console.log(`      test ${t.id}: ${t.input} expected=${t.expected} actual=${t.actual}`));
  }
  await sleep(400);
  return ok;
}

(async () => {
  let failures = 0;
  for (const p of PROBLEMS.filter((x) => !only.length || only.includes(x.id))) {
    const starters = starterCodes(p);
    for (const lang of langs) {
      const ref = lang === 'java' ? p.referenceSolution : (REFERENCES[p.id] || {})[lang];
      if (ref && !(await check('reference', ref, p, lang, true, true))) failures++;
      if (checkStarter && !(await check('starter', starters[lang], p, lang, false, false))) failures++;
    }
  }
  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
