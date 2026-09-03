# AUDIT.md — data-flow log

Updated at the end of every phase in `PLAN.md`. This file answers one question for a school IT reviewer:
**where can student data go, and why is each path safe?**

## Claim

The deployed site is static. Every request the browser makes is a same-origin GET for a file in this
repository. No request ever carries student input. This is enforced by a Content-Security-Policy
(`netlify.toml` header, an identical `<meta http-equiv>` on every page, and `tests/serve.js` in tests)
and proven by `tests/network-audit.spec.js`, which scripts a full student session (home → teleop level →
path planner save → strategy save → quiz → theory answer → report → about → export) and asserts that
every request is same-origin, `GET`, has no query string and no body.

## Status

| Phase | State | Tag |
|---|---|---|
| 0 — freeze v1, docs, fixtures | done 2026-09-01 | `v1-final` |
| 1 — kill the network | done 2026-09-01 | `v2-phase-1` |
| 2 — local persistence (sessionStorage backend, export/import) | done 2026-09-01 | `v2-phase-2` |
| 3 — report without Gemini (BKT mastery, charts, rule-based text) | done 2026-09-01 | `v2-phase-3` |
| 4 — theory grading without Gemini (rubric grader) | done 2026-09-01 | `v2-phase-4` |
| 5 — code checkpoints without Gemini (structural checker) | done 2026-09-01 | `v2-phase-5` |

## Where student data lives

| Place | What | Lifetime | Who can see it |
|---|---|---|---|
| JavaScript memory | the live `RTStore` state | until the page unloads | the student |
| `sessionStorage["rt-state"]` | the same state, serialized (see `js/schema.js`) | this browser **tab**; cleared when the tab closes; not shared with other tabs or users | the student, on that device |
| `rtracker-progress-YYYY-MM-DD.json` | the full state, pretty-printed | until the student deletes it | whoever the student gives the file to |
| Server | **nothing** — static files only | n/a | n/a |

`RT_STORAGE_BACKEND = 'session'` in `js/store.js`. Changing it to `'memory'` (one constant) makes the app
session-only with the export file as the sole persistence, the fallback if the school also rejects
tab-scoped storage. Tests exercise both backends.

## Browser storage keys

| Key | Where | Contents | Lifetime | Student data? |
|---|---|---|---|---|
| `rt-state` | sessionStorage | `RTStore` state | tab | **yes** |
| `rt-stl-model` | sessionStorage | base64 of an optional robot STL model uploaded for the 3D view (cached only if ≤ 2.5 M chars) | tab | no — a CAD file, not about the student; not exported |
| `rt-nav` | sessionStorage | `"1"` for ~150 ms during an in-app page transition | milliseconds | no |
| `rt-theme` | localStorage | `"dark"` or `"light"` | device | no — UI preference. Absent means light glass, the default look. |

Nothing else is written to any storage API (IndexedDB, cookies, Cache API are unused). The audit test
asserts `localStorage` contains only `rt-theme` and `sessionStorage` only `rt-*` keys.

### Design pass — "Summit Atmosphere" (2026-09-02)

Every page (the homepage, the six tool pages and `404.html`) was restyled from a design produced outside
the app. It changes nothing in this document's claim, and the checks below were re-run against it:

- **One new request, and it carries nothing.** Every page loads `assets/summit-sky.webp` (63 KB), a
  static picture of the sky committed to the repo — a same-origin GET for a file, with no query string,
  no body and nothing derived from the student. It is generated offline by `tools/bake-sky.mjs` from
  `assets/summit-sky.svg`; neither the tool nor the SVG runs or is fetched at request time. Every icon
  is inline SVG (`window.RT_ICONS` in `js/sidebar.js`, hydrated into `data-rt-icon` placeholders) — no
  icon font, no sprite sheet, no emoji. `tests/network-audit.spec.js` covers this request like any other
  and still reports every request across the 7 pages as a same-origin GET.
- **No new storage.** The theme still rides the one `rt-theme` localStorage key; the design adds no key
  of its own. `tests/smoke.spec.js` asserts the key list is exactly `['rt-theme']`.
- **No new third-party code.** Nothing was vendored; `css/fonts.css`, `js/schema.js`, `js/store.js` and
  `js/utils/validators.js` are byte-identical to before.
- **Charts and the 3D scene read colours from CSS tokens** (`getComputedStyle` on `<html>`), and re-draw
  on the `rt-themechange` event that the theme toggle dispatches. That event carries only `{ dark }`.
- The CSP is unchanged and still forbids cross-origin loads. `404.html` now carries the same
  `<meta http-equiv>` copy as the other pages (it had none before).

### Quota handling
`sessionStorage` is ~5 MB per origin. If a save hits the quota, `RTStore.save()` drops the cached STL, then
trims history (coach reports to 3, attempts to 1000, code checks to 3 per phase, theory history to 3), and
if that still fails keeps the state in memory and shows "Storage full — export now".

## Export / Import

- **Export** (`js/sidebar.js` → `rtExportProgress`): serializes the state to a `Blob` and clicks a detached
  `<a download>`. The browser saves the file; no request is made (the audit test checks the request count
  is unchanged and ignores `blob:` URLs, which are in-memory objects).
- **Import** (`rtImportProgress`): a hidden `<input type="file">` read with `FileReader`; the JSON is
  validated by `RTSchema.validateImport` (schema version, known keys, ranges, string/array caps, ≤ 4 MB),
  the student confirms the overwrite, then the page reloads. Imported strings are **untrusted**: every
  render path escapes them (`esc()`, `sanitizeHTML()`, `escSidebar()`), and `tests/persistence.spec.js`
  imports an HTML-injection payload and asserts it renders inert.
- Unexported changes are flagged by a sidebar status line and a bottom banner; milestones show a toast;
  closing the tab with unexported progress triggers the browser's leave-page prompt (in-app navigation
  never does — it sets `rt-nav` first).

## Outbound calls (grep gate 2) and why each is safe

| File | Hit | Why safe |
|---|---|---|
| `js/teleop/field.js:6`, `js/pathplanner/canvas.js:12`, `js/strategy.js:14` | `new Image()` | loads the local field picture `assets/decode.webp` (same origin) |
| `vendor/three/three.min.js` | `XMLHttpRequest` inside three.js `FileLoader` | unreachable: `js/teleop/view3d.js` reads the STL with a `FileReader` and calls `STLLoader.parse(arrayBuffer)`; nothing ever calls `load(url)` |
| `vendor/three/STLLoader.js` | `load()` method | never called (see above) |

No `fetch`, `WebSocket`, `sendBeacon` or `<form>` submission exists in application code.

## Content-Security-Policy

`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`

`'unsafe-inline'` is required for scripts and styles because every page uses inline `<script>` blocks,
`on*=""` handlers and `style=""` attributes, and there is no build step to add nonces. It does not weaken
the privacy claim: `connect-src 'none'` and `default-src 'self'` forbid any request to another origin, and
the audit test verifies the header and the per-page meta copy are identical.

## Removed in Phase 1

Firebase Auth and Firestore SDKs and `config.js`; `js/auth.js`, `js/firebase-auth.js`, `js/firebase-init.js`;
the Gemini client `js/curriculum/gemini.js`; Netlify functions (`netlify/`), legacy Vercel handlers (`api/`),
Cloud Functions (`functions/`), `firestore.rules`, `firebase.json`, `.firebaserc`; team join/leave, leaderboards,
team activity feeds, the coach dashboard and manage-team pages; Google Fonts and cdnjs/jsdelivr script tags;
`build.js`/`build.sh`/`vercel.json`.

## Grading (all local, deterministic)

- **Theory answers** (`js/grader.js`, Phase 4): each written-answer check in `js/curriculum/lessons.js`
  carries a rubric — required concepts with accepted phrasings and a hint, optional disqualifying
  misconceptions, and a pass threshold. The answer is normalized and matched with substring / word-level
  fuzzy matching (Levenshtein ≤ 1 for words of 5+ letters); score = concepts hit ÷ concepts required.
  The answer text and result stay in `curriculum.phases[*].theoryAnswers` (exported for the mentor);
  only the pass/fail signal feeds mastery (`js/bkt.js`). One question (`theory-triage`) is a
  **reflection** (`graded: false`): stored for the mentor, never scored, excluded from mastery.
  `tests/grader.test.js` checks the grader against `tests/fixtures/theory-samples.json` (52 hand-labeled
  answers): agreement is 48/48 on the graded questions (≥ 90% is the gate).
- **Code submissions** (`js/code-check.js` + `js/curriculum/code-rules.js`, Phase 5): a **structural**
  check — regex/string patterns per phase (required patterns with weights and hints, forbidden patterns
  with penalties, balanced braces). Comments and string literals are blanked before matching unless a rule
  is marked `raw`. Score = weighted share of required patterns met minus penalties; a phase auto-verifies
  at ≥ 75 with no CRITICAL hit. The UI and the result text both say it does not compile, run, or verify
  behaviour. Student code is **never executed or uploaded** — `tests/code-check.test.js` greps the checker
  source for `eval`/`new Function`/workers/fetch, and grep gate 4 does the same across the repo. Every
  submission and its result are kept in `curriculum.phases[*].reviews` and exported for the mentor. The
  strategy module (`advanced_strategy`) is a written analysis and is kept as a mentor-review submission.
  A student can also mark any deliverable **submitted** for a mentor, which unlocks the next phase but is
  never displayed as verified.

## Third-party code shipped (vendored, read, no runtime network)

- three.js r128 (MIT): `vendor/three/three.min.js`, `STLLoader.js`, `OrbitControls.js` — SHA-256 in `vendor/three/SHA256SUMS`, sources in `vendor/README.md`.
- Inter variable font (SIL OFL 1.1): `assets/fonts/InterVariable.woff2`, license in `assets/fonts/OFL.txt`.
- `assets/summit-sky.webp` is not third-party: it is our own `assets/summit-sky.svg` rendered to a
  raster by `tools/bake-sky.mjs`. No stock photo, no external asset.
