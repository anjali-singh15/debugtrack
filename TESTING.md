# DebugTrack: Test Checklist & Results

Last full run: 2026-10-07 · Node 22 · Chrome (headless) · public Judge0 CE

How each item was verified:
**A** = automated API/unit test (`npm test`, 49 tests) · **E** = automated browser test (headless Chrome driving the real UI) · **V** = verification script (`npm run verify:problems`) · **M** = manual check (screenshots reviewed)

## Auth
| Check | How | Result |
|---|---|---|
| Registration with valid data → JWT, lands on dashboard | A, E | ✅ |
| Required fields / invalid email / short password / mismatch → field errors | A, E | ✅ |
| Duplicate email (case-insensitive) → 409 + message | A, E | ✅ |
| Invalid login → generic "Invalid email or password" | A, E | ✅ |
| Valid login (incl. demo account) | A, E | ✅ |
| Logout clears token, returns to login | E | ✅ |
| Missing / invalid / forged / expired token → 401 on every private API | A | ✅ |
| Invalid token in browser → redirect to login + "session" toast | E | ✅ |
| Logged-in user visiting /login is redirected to dashboard | E | ✅ |
| Password hash never present in any response | A | ✅ |

## Problems
| Check | How | Result |
|---|---|---|
| Catalogue lists all 37 problems across all 11 required topics | A, E | ✅ |
| Search, difficulty, topic, status and "recommended" filters | E | ✅ |
| Per-user status (Solved / Attempted / Not Started) is independent per user | A | ✅ |
| Problem detail: statement, examples, constraints, hints | E | ✅ |
| Hidden tests & reference solutions never sent to the browser | A | ✅ |
| Unknown problem → 404 / friendly error | A | ✅ |

## Code execution
| Check | How | Result |
|---|---|---|
| Correct solution → Accepted (sample + hidden) | A | ✅ |
| Wrong solution → Wrong Answer with per-test results | A, E | ✅ |
| Compilation error → shown with the student's line numbers | A, E | ✅ |
| Runtime error → exception + line shown | A | ✅ |
| Infinite loop → Time Limit Exceeded | A | ✅ |
| Empty code / non-Java / malformed JSON / missing problemId → 400 | A | ✅ |
| Run stores nothing; Submit stores the attempt | A | ✅ |
| All 37 Java reference solutions pass all 195 tests | V | ✅ |
| Python & C++ references (17 problems covering every argument/return type) pass all their tests | V | ✅ |
| Every starter template compiles/runs in Java, Python and C++ (111 checks) | V | ✅ |
| Language switcher loads the right starter + syntax highlighting; drafts kept per language | E | ✅ |
| Python run from the UI; Python None dereference → Null Handling; Python syntax error → Compilation Error with line | A, E | ✅ |
| C++ out-of-bounds → Array Indexing (exact index from debug check); crash isolated per test; compile error line mapped | A, E | ✅ |

## Submissions
| Check | How | Result |
|---|---|---|
| Submission saved with code, verdict, runtime, memory, tests, analysis | A | ✅ |
| Previous attempts listed; "Load" restores code into Monaco | E | ✅ |
| Editor draft survives page refresh | E | ✅ |
| Data persists after backend restart | M (server restarted, dashboard API returned same 31 submissions) | ✅ |
| Another user's submission → 404; lists are user-scoped | A | ✅ |

## Mistake engine
| Check | How | Result |
|---|---|---|
| Array Indexing (AIOOBE, off-by-one, negative index) | A (unit + live Judge0) | ✅ |
| Null Handling (NPE) | A (unit + live Judge0) | ✅ |
| Loop Logic: stuck loop (Detected), TLE/off-by-one (Possible) | A (unit + live Judge0) | ✅ |
| Boundary Conditions (only edge cases fail) | A (unit + live Judge0), E | ✅ |
| Runtime Errors (StackOverflow, Arithmetic, EmptyStack, other) | A | ✅ |
| Unclassified when evidence is insufficient | A | ✅ |
| Compile errors / unchanged starter not counted as patterns | A | ✅ |

## Analytics & recommendations
| Check | How | Result |
|---|---|---|
| Dashboard numbers equal database counts | E | ✅ |
| Dashboard/analytics/mistakes update after a submission | A | ✅ |
| New user sees zeros + empty-state guidance (no mock values) | E | ✅ |
| Analytics renders 6 charts; Mistake Patterns renders 2 charts | E | ✅ |
| Solved problems are not recommended; every recommendation has reasons | A, E | ✅ |
| Profile edit and settings persist to the backend | A, E | ✅ |

## Responsiveness & workspace
| Check | How | Result |
|---|---|---|
| Vertical divider resizes panels; Monaco re-layouts (646 → 803 px) | E | ✅ |
| Horizontal divider resizes editor/console (430 → 306 px) | E | ✅ |
| Desktop 1440 px, tablet 1100 px, phone 390 px layouts (no horizontal overflow) | E, M | ✅ |
| Mobile sidebar menu opens with backdrop | M | ✅ |

## Notes
- Browser walkthrough: 52/52 checks passed (including the Python/C++ steps).
- The only browser-console entries during the E2E run were the network logs for the
  intentional negative tests (409 duplicate email, 401 wrong password / forged token).
  There were no JavaScript errors.
- Tests that use Judge0 need internet access; run `SKIP_JUDGE0=1 npm test` offline.
