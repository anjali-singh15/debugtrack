# ⚡ DebugTrack: An Intelligent Coding-Practice & Mistake-Analytics Platform

> Full-Stack Development (FSD) college project · AngularJS + Node.js/Express + SQLite + Judge0 CE

---

## 1. Problem Statement

Most coding-practice platforms only report a **binary outcome** (Accepted / Wrong Answer). Students
see *that* a solution failed, but not *why*, and they have no view of the mistakes they keep
repeating (off-by-one indexing, missing null checks, unhandled edge cases...). Without that
feedback, practice is unfocused: students keep solving problems they are already good at.

## 2. Objective

Build a web platform where students:

1. solve curated problems in **Java, Python or C++** in a LeetCode-style workspace,
2. have their code executed **safely in a sandbox** (Judge0 CE),
3. receive an **explainable, rule-based diagnosis** of every failed submission,
4. see their **personal mistake patterns, weak topics and progress** over time, and
5. get **recommendations that explain why** a problem was chosen for them.

No AI/ML or external LLM APIs are used. Every diagnosis comes from a named, documented rule.

## 3. Features

| Area | What it does |
|---|---|
| **Authentication** | Register (name, email, password, confirm) with validation & duplicate-email handling; login with JWT; logout; protected routes; session-expiry handling. Passwords hashed with bcryptjs. |
| **Problem catalogue** | 37 curated problems (Java / Python / C++) across 11 topics; search, difficulty / topic / status / "recommended for me" filters; per-user solved status; live acceptance rate; recommended badge with reason. |
| **Solve workspace** | Problem statement, examples, constraints, hints · Monaco editor with a **language switcher (Java, Python, C++)** and a separate auto-saved draft per language · Run Code / Submit · console with Test Cases, Console, Submission Result and Previous Attempts tabs · **draggable vertical and horizontal dividers** (Monaco re-layouts automatically) · draft auto-save. |
| **Code execution** | Judge0 CE sandbox for Java 17, Python 3.8 and C++ (GCC 9.2); per-test results, runtime, memory, compiler errors mapped to *your* line numbers, runtime exceptions with line numbers, time-limit detection, friendly errors when Judge0 is unavailable. |
| **Submissions** | Every submission stored with code, verdict, runtime, memory, tests passed, test results and mistake analysis. Submission History page with detail view and "open in editor". |
| **Mistake engine** | Rule-based classification into Array Indexing, Null Handling, Loop Logic, Boundary Conditions, Runtime Errors or Unclassified, each with explanation, evidence, suggested improvement, related practice topic and confidence ("Detected" vs "Possible mistake"). |
| **Mistake Patterns** | Total mistakes, most frequent mistake, weakest topic, category distribution chart, weekly improvement trend, mistake history, and the full rule catalogue. |
| **Analytics** | Overview (attempted, solved, submissions, accuracy, average runtime), solved-over-time, accuracy trend, mistakes over time, category distribution, topic-wise attempts & accuracy, topic breakdown table. |
| **Recommendations** | Rule-based: recurring mistake, secondary mistake, weakest topic, unfinished attempts, new-topic exploration. Solved problems are never recommended. Every recommendation lists its reasons. |
| **Dashboard** | Real stats, current weak area, most frequent mistake, recent submissions, recommended problems, 8-week progress chart, notifications. |
| **Profile & Settings** | Profile with stats, rank, topic progress, last-7-days activity, solved problems, computed achievements, editable name & university. Settings: default language, editor font size, tab size, word wrap, minimap, diagnostics popup, account info, password change. |

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | AngularJS 1.8 (ngRoute), HTML5, CSS3, JavaScript, Monaco Editor 0.45, Chart.js 4, Font Awesome |
| Backend | Node.js (≥ 18), Express 5, REST APIs |
| Database | SQLite (`sqlite3` driver) |
| Code execution | Judge0 CE (public instance `https://ce.judge0.com` by default; configurable): Java 17 (id 91), Python 3.8 (id 71), C++ GCC 9.2 (id 54) |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Testing | Node's built-in test runner (`node --test`) |

## 5. System Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│ AngularJS SPA (index.html + pages/*.html)                        │
│  ├─ AuthService / AuthInterceptor  → JWT in localStorage,        │
│  │                                   adds "Authorization: Bearer"│
│  ├─ ApiService                     → REST calls                  │
│  ├─ Controllers (Dashboard, Problems, Solve, Mistakes, ...)      │
│  └─ Directives: monacoEditor, paneResizer, dtChart (Chart.js),   │
│                 analysisCard, testResultList                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ JSON over HTTP
┌───────────────────────────────▼──────────────────────────────────┐
│ Express server (backend/server.js)                               │
│  routes/      auth · problems · submissions · execution ·        │
│               insights (dashboard/analytics/mistakes/recs) ·     │
│               profile (+ settings)                               │
│  middleware/  auth (JWT verify) · rateLimit                      │
│  services/    submissionService (run/submit pipeline)            │
│               analyticsService (stats derived from submissions)  │
│               recommendationService (rules R1–R5)                │
│               problemService (catalogue cache, public mappers)   │
│  languages/        java.js · python.js · cpp.js test harnesses   │
│  judgeService.js   calls Judge0, parses results, decides verdict │
│  mistakeEngine.js  rule-based classification                     │
│  database.js       SQLite schema, migrations, promise helpers    │
└──────────────┬───────────────────────────────┬───────────────────┘
               │ SQL                           │ HTTPS (base64 source)
        ┌──────▼──────┐                 ┌──────▼──────────┐
        │  SQLite DB  │                 │  Judge0 CE      │
        │ debugtrack  │                 │  (sandboxed     │
        │    .db      │                 │ Java/Py/C++)    │
        └─────────────┘                 └─────────────────┘
```

Untrusted student code is **never executed by the Node.js process**. It is only sent to Judge0.

## 6. Database Design

```
users ────────────────┐ 1
  id PK               │
  name, email UNIQUE  │
  passwordHash        │        problems
  role, university    │          id PK (slug, e.g. "two-sum")
  settings (JSON)     │          number, title, difficulty, topic
  createdAt           │          focus (JSON: mistake categories it trains)
                      │          mistakeProneArea, description, examples,
                      │ *        constraints, hints, starterCode
submissions ──────────┘          testCases (JSON, incl. hidden; server-only)
  id PK                          referenceSolution (server-only)
  userId FK → users.id (ON DELETE CASCADE)        ▲ 1
  problemId FK → problems.id  ────────────────────┘ *
  code, language, status
  runtime, memory, runtimeMs, memoryKb
  testCasesPassed, totalTestCases, testResults (JSON)
  mistakeCategory, mistakeConfidence, ruleMatched
  feedback, suggestion, evidence (JSON), practiceTopic
  timestamp (ISO-8601 UTC)
  INDEX (userId, timestamp), INDEX (userId, problemId)
```

**Analytics are not stored.** Dashboard, analytics, mistake patterns, streaks, achievements and
recommendations are computed from `submissions` on every request, so they can never become
inconsistent with the underlying data. (The Review-1 `analytics` table held static mock numbers
and is dropped automatically by the migration in `database.js`.)

Solved status is per user: a problem is *Solved* for a user if that user has at least one
Accepted submission for it. Two users solving the same problem are tracked independently.

## 7. API Overview

All endpoints return JSON. Endpoints marked 🔒 require `Authorization: Bearer <JWT>`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Server & database status |
| POST | `/api/auth/register` | Create account `{name, email, password, confirmPassword}` → `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| GET 🔒 | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Stateless; client discards its token |
| GET 🔒 | `/api/problems` | Catalogue with the user's status, acceptance, recommended flag + reason |
| GET 🔒 | `/api/problems/:id` | Problem detail with **sample tests only** |
| GET 🔒 | `/api/problems/:id/submissions` | The user's previous attempts on a problem |
| POST 🔒 | `/api/run` | Run sample tests `{problemId, code, language}`; nothing is stored |
| POST 🔒 | `/api/submit` | Run sample + hidden tests, analyse, store → result + `submissionId` |
| GET 🔒 | `/api/submissions` | The user's submissions (`?problemId=&status=&limit=`) |
| GET 🔒 | `/api/submissions/:id` | One submission (owner only, otherwise 404) |
| GET 🔒 | `/api/dashboard` | Overview, weak area, mistakes, recent submissions, recommendations, weekly series, notifications |
| GET 🔒 | `/api/analytics` | Overview, categories, topic stats, weekly series, improvement |
| GET 🔒 | `/api/mistakes` | Mistake summary, categories, history, trend, rule catalogue |
| GET 🔒 | `/api/recommendations` | Recommended problems with reasons |
| GET/PUT 🔒 | `/api/profile` | Profile + stats + achievements / update name & university |
| PUT 🔒 | `/api/profile/password` | Change password (requires current password) |
| GET/PUT 🔒 | `/api/settings` | Editor preferences |
| GET 🔒 | `/api/data` | Review-1 aggregate endpoint, kept for compatibility (now user-specific) |

Errors use proper status codes (400 validation, 401 auth, 404 not found, 409 duplicate email,
413 too large, 429 rate limited, 502/503/504 execution service problems, 500 unexpected) and
always return `{ "error": "<friendly message>" }`, never a stack trace.

## 8. Code Execution Flow

```
Run / Submit clicked
  → POST /api/run | /api/submit  (JWT checked, rate limited, input validated:
                                  non-empty, ≤ 50 KB, language java|python|cpp, problem exists)
  → languages/<lang>.buildHarness()  adds ListNode/TreeNode helpers and, for every test:
       print "---TC_<id>---"; run the student's method; print "@@RESULT@@<formatted value>"
       Java   : try/catch(Throwable) per test → "@@ERROR@@<type>@@<line>@@<message>";
                imports hoisted (line numbers preserved), `public class Solution` allowed
       Python : try/except per test; the student's line comes from the traceback;
                syntax errors are reported as Compilation Error
       C++    : compiled with _GLIBCXX_DEBUG (out-of-range indexing → precise abort message);
                each test runs in a fork()ed child, so a crash only affects that test
                ("@@CRASH@@<signal>")
  → POST to Judge0 (base64, cpu limit 2 s, memory 256 MB; polling fallback)
  → parse output per test: student's own prints, result, or error (+ mapped line)
  → compare with expected output (whitespace-normalised; order-insensitive where allowed)
  → verdict: Accepted | Wrong Answer | Runtime Error | Time Limit Exceeded | Compilation Error
  → mistakeEngine.analyzeSubmission()
  → (submit) INSERT INTO submissions   → analytics/recommendations update on next request
```

Hidden tests: only the **first failing** hidden test's input/expected/actual is revealed after a
submission; the others show pass/fail only. Hidden test inputs are never sent before submission.

Judge0 failures (unreachable, timeout, rate limit, internal error) return 502/503/504 with a
friendly message, and the attempt is **not** stored (it was not the student's fault).

## 9. Mistake Detection Flow

The engine (`backend/mistakeEngine.js`) uses only concrete evidence: the error type, message
and line from the harness (each language's errors are mapped to common kinds: index, null,
stack-overflow, arithmetic, empty-collection, segfault, other), which tests failed (tests are labelled as edge cases such as "empty
array" or "single element"), the shape of wrong outputs, and simple code patterns.

| Rule | Category | Confidence | Trigger |
|---|---|---|---|
| AI-01 | Array Indexing | Detected | Java `IndexOutOfBounds…`, Python `IndexError`, C++ out-of-bounds subscript / `std::out_of_range` (evidence adds: index = length → off-by-one; negative index; empty input; `i <= n` / `range(len(a) + 1)` loops) |
| NH-01 | Null Handling | Detected | Java `NullPointerException`, Python `AttributeError`/`TypeError` on `None` (evidence adds: message, line, missing null checks, empty-input edge case) |
| NH-02 / AI-03 | Null Handling / Array Indexing | Possible | C++ segmentation fault (no exception exists in C++): linked-list/tree problems → probable null pointer, otherwise probable bad index |
| LL-01 | Loop Logic | Detected | Time Limit Exceeded **and** a `while` loop whose condition variables are never modified |
| LL-02 | Loop Logic | Possible | Time Limit Exceeded without a provably stuck loop (notes exponential recursion without memoisation) |
| LL-03 | Loop Logic | Possible | Every wrong output is off by exactly 1 (or a list is one element too long/short) |
| BC-01 | Boundary Conditions | Detected | All failing tests are edge cases while regular tests pass |
| RE-01..04 | Runtime Errors | Detected | Stack overflow / `RecursionError`, division by zero (`ArithmeticException`, `ZeroDivisionError`, SIGFPE), popping an empty stack/queue, any other exception |
| UC-01 | Unclassified | — | Wrong answer with no rule matching: failing test + general debugging advice |
| CE-01 | (not counted) | — | Compilation errors are reported (with mapped line numbers) but are not logic mistake patterns |
| NS-01 | (not counted) | — | Starter code submitted unchanged |

Each analysis contains **category, confidence, rule id, short explanation, evidence list,
suggested improvement and related practice topic**. When evidence is weak, the UI labels the
result **"Possible mistake"**, or the engine returns **Unclassified**. It never guesses.

## 10. Recommendation Flow

`backend/services/recommendationService.js` scores every problem the student has **not solved**:

| Rule | Points | Reason shown to the student |
|---|---|---|
| R1 | 4 + min(count, 5) | "Recommended because you have recently made *N* Array Indexing mistakes; this problem practises …" (problem's `focus` contains the most frequent of the last 15 classified mistakes) |
| R2 | 2 | "Also targets *X*, your next most frequent mistake." |
| R3 | 3 | "*Topic* is your weakest topic (*a*% accuracy over *n* submissions)." |
| R4 | 2 | "You attempted this problem *k* times but have not solved it yet." |
| R5 | 0.5–1 | New students: Easy starter problems; otherwise topics never attempted. |
| — | −2 | Hard problems while overall accuracy < 50%. |

Results are sorted by score (then easier first), at most 2 per topic, top 4 on the dashboard.

## 11. Installation

Prerequisites: **Node.js 18+** and an internet connection (for Judge0 CE and the CDN libraries).

```bash
cd debugtrack/backend
npm install
npm run setup        # creates a fresh database, loads 37 problems, creates the demo account,
                     # and generates the demo history by running real code on Judge0 (~2 min)
```

`npm run setup` resets the database. To only (re)load problems without touching users or
submissions, run `npm run seed`.

**Demo account:** `demo@debugtrack.dev` / `Demo@1234`

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | Server port |
| `JUDGE0_URL` | `https://ce.judge0.com` | Judge0 instance (e.g. a self-hosted one) |
| `JUDGE0_API_KEY` | — | API key for a RapidAPI / authenticated Judge0 |
| `JUDGE0_JAVA_ID` / `JUDGE0_PYTHON_ID` / `JUDGE0_CPP_ID` | 91 / 71 / 54 | Judge0 language ids |
| `JWT_SECRET` | auto-generated in `backend/.jwt-secret` | Token signing secret |
| `JWT_EXPIRES_IN` | `12h` | Token lifetime |
| `DB_PATH` | `backend/debugtrack.db` | SQLite file location |

## 12. Running the Application

### Backend (also serves the frontend)
```bash
cd debugtrack/backend
npm start
```
Open **http://localhost:3000**. The Express server serves `index.html`, `css/`, `js/` and
`pages/`; the `backend/` folder (database, secret) is never served.

### Frontend on its own (optional)
The SPA can also be served by any static server; it then calls the API at `http://localhost:3000/api`:
```bash
cd debugtrack
python3 -m http.server 8080      # then open http://localhost:8080
```
The backend must still be running.

## 13. Testing

```bash
cd debugtrack/backend
npm test                     # 50 automated tests (unit + API integration, uses real Judge0)
SKIP_JUDGE0=1 npm test       # offline: skips the tests that need Judge0
npm run verify:problems      # on Judge0: every Java reference solution (all 195 tests),
                             # Python + C++ references for 17 problems covering every
                             # parameter/return type, and every starter in all 3 languages
```

- `tests/mistakeEngine.test.js`: every mistake rule, harness parsing, output comparison, line mapping.
- `tests/api.test.js`: runs against a throw-away database and a real server. It covers registration
  validation, duplicate email, login, invalid/forged/expired tokens, protected routes, hidden-test
  secrecy, run vs. submit, Accepted / Wrong Answer / Compilation Error / Runtime Error / TLE,
  user isolation, analytics, profile, settings, rate limiting, and that the DB file is not served.

The manual + browser test checklist and its results are in **[TESTING.md](TESTING.md)**.

## 14. Project Structure

```
debugtrack/
├── index.html                  SPA shell: sidebar, navbar, search, settings, toasts
├── css/style.css               Dark developer-studio design system
├── js/app.js                   Module, routes + auth guard, services, filters, directives
├── js/controllers.js           One controller per view
├── pages/                      Route templates (+ partials/ for analysis card & test results)
├── lib/                        Local AngularJS fallbacks
└── backend/
    ├── server.js               Express app, static hosting, error handler
    ├── database.js             Schema, migrations, promise helpers
    ├── judgeService.js         Judge0 client, output parsing, verdicts
    ├── languages/              java.js, python.js, cpp.js (harness + starter code per language)
    ├── mistakeEngine.js        Rule-based mistake detection
    ├── seed.js                 Problems + demo account
    ├── data/problems.js        Problem bank (statements, Java starter code, tests, reference solutions)
    ├── data/signatures.js      Language-neutral method signatures (used to generate Python/C++ calls & starters)
    ├── data/referenceSolutions.js  Python/C++ references for harness verification
    ├── middleware/             auth.js (JWT), rateLimit.js
    ├── routes/                 auth, problems, submissions, execution, insights, profile
    ├── services/               problem, analytics, recommendation, submission
    ├── scripts/                seedDemo.js, verifyProblems.js
    └── tests/                  node:test suites
```

## 15. Security Measures

- Passwords hashed with **bcryptjs** (cost 10); hashes are never returned by any endpoint.
- **JWT** on every private endpoint; invalid, forged and expired tokens get 401, and the client
  redirects to login with a "session expired" message.
- Every query is scoped by the authenticated `userId`; another user's submission returns 404.
- Input validation on all write endpoints; parameterised SQL everywhere.
- Code runs only in **Judge0's sandbox**, with CPU/memory limits. Code size is limited to 50 KB.
- Hidden tests and reference solutions are never sent to the browser.
- In-memory **rate limiting** on login/register (30 per 15 min) and run/submit (20 per minute).
- Generic login error ("Invalid email or password") to avoid account enumeration.
- The JWT is kept in `localStorage` (simple for a SPA calling a separate API). The trade-off is
  that an XSS bug could read it, so templates rely on AngularJS escaping, and the only HTML
  rendering (`richText` filter) escapes all input first.

## 16. Limitations

- **The mistake engine cannot understand every programming mistake.** It is a transparent set
  of rules over runtime evidence, test outcomes and simple code patterns. Logical errors that do
  not produce an exception, an edge-case-only failure or an off-by-one pattern are reported as
  **Unclassified** with a general debugging suggestion. "Possible mistake" results are hints, not
  verdicts.
- A Time Limit Exceeded result cannot always distinguish an infinite loop from a slow algorithm,
  so it is reported as *possible* unless a stuck loop is visible in the code.
- Three languages (Java, Python 3.8, C++). Tests are authored once as Java calls; Python/C++ calls
  are generated from each problem's signature. Java references are verified for every problem,
  Python/C++ references for 17 problems that together cover every argument/return type.
- In C++ a segmentation fault does not say which access failed, so it is only a *possible*
  Null Handling / Array Indexing mistake. Python 3.8 is used because the Python 3.11 runtime on
  the public Judge0 instance needs more than 2 s just to start.
- The public Judge0 CE instance needs internet access and may be slow or rate-limited.
  A self-hosted Judge0 can be configured with `JUDGE0_URL`.
- Runtime/memory come from a single Judge0 run of all tests (including JVM start-up), so they are
  indicative, not benchmark-grade.
- Rate limiting is in-memory (resets on restart; single server process only).
- The demo account's history was produced by running real code through the normal pipeline, but
  its timestamps are back-dated across the previous five weeks so the trend charts have data.

## 17. Future Enhancements

- More languages (JavaScript, Go) via additional harness modules in `backend/languages/`.
- Custom test input in the console; per-test runtime.
- Instructor role: create problems, view class-wide mistake analytics.
- Richer static analysis (e.g. AST-based detection of unused loop variables).
- Spaced-repetition scheduling of recommended problems.
- HttpOnly-cookie sessions with refresh tokens; persistent (Redis) rate limiting.
- Docker Compose file bundling a self-hosted Judge0.
