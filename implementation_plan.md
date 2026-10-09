# DebugTrack: Implementation Plan (Review 2 / Final)

## Goal
Take the Review-1 prototype (single demo user, partly mock data) to a complete multi-user,
data-driven platform without changing the stack: AngularJS 1.x · Express · SQLite · Judge0 CE ·
Monaco · Chart.js · JWT + bcryptjs.

## Principles
1. Incremental changes. Keep the existing UI, design system, routes, resizable workspace and APIs.
2. Every statistic is derived from real submissions. No hard-coded numbers.
3. Mistake detection stays rule-based and explainable, and says "possible"/"unclassified" when unsure.
4. Untrusted code runs only in Judge0.

## Phases
| # | Phase | Key files | Status |
|---|---|---|---|
| 1 | Audit existing code, schema, Judge0 integration | all | ✅ |
| 2 | Schema cleanup + additive migrations, promise helpers | `backend/database.js` | ✅ |
| 3 | Server-side problem bank (37 problems, sample/hidden/edge tests, reference solutions) | `backend/data/problems.js`, `seed.js` | ✅ |
| 4 | Judge0 harness rewrite + error handling | `backend/judgeService.js` | ✅ |
| 5 | Mistake engine with evidence & confidence | `backend/mistakeEngine.js` | ✅ |
| 6 | JWT auth, middleware, rate limiting | `backend/routes/auth.js`, `middleware/*` | ✅ |
| 7 | User-scoped services: analytics, recommendations, run/submit pipeline | `backend/services/*` | ✅ |
| 8 | Routes: problems, submissions, execution, insights, profile/settings | `backend/routes/*`, `server.js` | ✅ |
| 9 | Frontend auth (pages, service, interceptor, guard) | `js/app.js`, `pages/login.html`, `pages/register.html` | ✅ |
| 10 | Data-driven views + Submissions page + Settings | `js/controllers.js`, `pages/*` | ✅ |
| 11 | CSS for new components, responsive fixes | `css/style.css` | ✅ |
| 12 | Tests: unit, API integration, problem verification, browser walkthrough | `backend/tests/*`, `backend/scripts/*` | ✅ |
| 13 | Real demo data via the normal pipeline | `backend/scripts/seedDemo.js` | ✅ |
| 14 | Documentation | `README.md`, `TESTING.md`, `task.md` | ✅ |

## Key design decisions
- **Analytics on demand**: computed from `submissions` per request (fast at college scale), so they can't go stale.
- **Problem data in code, loaded into SQLite by the seed**: content is versioned with the code; the DB stays the runtime source.
- **Per-test try/catch harness**: one crash doesn't hide other results, and gives exception + line evidence.
- **Edge-case labels on tests**: make Boundary Conditions detection evidence-based instead of string matching on inputs.
- **Frontend served by Express**: one command (`npm start`) runs the whole app; static serving is restricted to frontend folders.
- **JWT in localStorage**: simplest fit for the SPA; the XSS trade-off is documented in the README.
