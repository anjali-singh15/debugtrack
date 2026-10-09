# DebugTrack: Task Tracker

## Review 1 (done before this phase)
- [x] AngularJS SPA shell, dark theme, dashboard/problems/solve/mistakes/analytics/profile pages
- [x] Express + SQLite backend, Judge0 Java execution, submission persistence
- [x] Monaco editor, resizable LeetCode-style workspace
- [x] First rule-based mistake engine and recommendations (single demo user)

## Review 2 / Final (this phase)
### Authentication
- [x] Register / login / logout pages with client + server validation
- [x] bcryptjs password hashing, JWT issue + verification middleware
- [x] Route guard, HTTP interceptor, session-expiry redirect
- [x] Password change (requires current password)

### Multi-user data
- [x] All submissions, statuses, analytics and recommendations scoped by user id
- [x] Ownership checks on submission endpoints (404 for others' data)

### Problems & execution
- [x] Problem bank moved server-side (`backend/data/problems.js`); 10 existing + 27 new = 37 problems, 11 topics
- [x] Existing "starter code" (which contained full solutions) turned into skeletons; solutions kept server-side as reference
- [x] Hidden tests never sent to the client; edge-case labels on tests
- [x] Harness: per-test try/catch, import hoisting, line-number mapping, student stdout capture
- [x] Judge0: base64, polling fallback, timeouts, friendly 502/503/504 errors, 2 s CPU limit
- [x] Removed the old regex hack that forced `Runtime Error` on Accepted code
- [x] Verification script for all reference solutions and starters

### Mistake engine & recommendations
- [x] Six categories with confidence, evidence, suggestion, practice topic, rule id
- [x] "Possible mistake" / "Unclassified" when evidence is insufficient
- [x] Rule catalogue exposed to the Mistake Patterns page
- [x] Recommendation rules R1–R5 with reasons; solved problems excluded

### Pages
- [x] Dashboard, Problems, Solve, Mistake Patterns, Analytics, Profile fully data-driven
- [x] New Submission History page
- [x] Settings modal wired to backend (editor prefs, account, password)
- [x] Loading / empty / error states everywhere; inline-code rendering
- [x] Responsive fixes (mobile backdrop, stat grids, breadcrumb)

### Quality, docs & tests
- [x] Backend split into routes / services / middleware / utils
- [x] Analytics derived from submissions (static `analytics` table dropped)
- [x] Rate limiting, security headers, DB file never served
- [x] 38 automated tests (unit + API integration) passing
- [x] 47-step headless-browser walkthrough (46 pass; the remaining one is expected 4xx network logs)
- [x] README.md, TESTING.md, implementation_plan.md updated
- [x] Demo history generated from real Judge0 runs (`npm run setup`)

### Multi-language support (Java, Python, C++)
- [x] Language-neutral problem signatures; Python/C++ test calls and starter code generated from them
- [x] Python 3.8 harness (per-test try/except, traceback line numbers, syntax errors as Compilation Error)
- [x] C++ harness (GCC debug-mode bounds checks, fork() per test so crashes stay isolated)
- [x] Mistake engine works on language-neutral error kinds; new possible-mistake rules for C++ segfaults
- [x] Language switcher, per-language drafts, default-language setting, language shown in history
- [x] 182 Judge0 verification checks + new API/unit tests (49 total) passing

## Possible next steps
- [ ] More languages (JavaScript, Go); custom test input
- [ ] Instructor role and class analytics
- [ ] Self-hosted Judge0 via Docker Compose
