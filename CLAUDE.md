# CLAUDE.md — R-Tracker v2 (Zero-Data Rebuild)

You are working on the `v2` branch of R-Tracker. Your job is to convert the v1 app, step by step, into a
version that handles **no student data outside the student's own browser**. Read `PROJECT.md` for what
we're building and `PLAN.md` for the order of work. Do not skip phases in `PLAN.md`; each one ends with
a verification gate that must pass before you continue.

The frozen v1 reference lives at the git tag `v1-final` (and on `main` until v2 is merged). Read it with
`git show v1-final:<path>`; **never commit to `main` or move the tag.**

## Project overview

R-Tracker is a browser-based FTC (FIRST Tech Challenge) training platform for Team 25702 Rundle Robotics
Castle: 2D/3D driver-practice simulator, autonomous path planner, match strategy planner, a programming
curriculum with theory and code checkpoints, and a progress report. v1 used Firebase Auth + Firestore and
the Gemini API. v2 is the same product as a **static site**: no accounts, no database, no AI API, no
server. Progress lives in the browser tab (`sessionStorage`) and in a `.json` file the student exports.

- **Live (v1):** https://r-tracker.netlify.app — keeps deploying from `main` until v2 is merged.
- **GitHub:** github.com/ekanshgupta2001/R-Tracker

## Your three jobs

1. **Revitalize** — strip out the parts that no longer apply (Firebase Auth, Firestore, Cloud/Netlify
   Functions, Gemini) and rebuild the affected features (progress, report, theory grading, code checks)
   on a client-only architecture. Keep everything that already works and doesn't touch data (Three.js
   teleop practice, path planner, strategy planner, curriculum content, UI/animations).
2. **Debug** — every phase leaves the app in a runnable state. A half-migrated feature is hidden behind a
   flag or removed from navigation, never shipped broken. Playwright tests are updated alongside the
   code, not after.
3. **Audit** — before marking any phase complete, prove that no student data can be transmitted,
   persisted server-side, or displayed to anyone other than the student who produced it. Proof means
   grep results and a passing test, not a sentence saying "I checked."

## Hard constraints (never violate, never ask for exceptions)

- **No network requests carrying user-generated content.** No `fetch`/`XMLHttpRequest`/WebSocket calls
  that send anything a student typed, scored, or did. The only network activity is same-origin GETs of
  static files. Cross-origin requests are blocked by the Content-Security-Policy in `netlify.toml`, the
  `<meta http-equiv>` copy on every page, and `tests/serve.js`.
- **No authentication of any kind.** No Firebase Auth, no OAuth, no email/password, no "enter your name"
  that is stored anywhere but the local state / export file.
- **No server-side storage.** No Firestore, no Realtime DB, no Supabase, no analytics, no error reporting
  services, no leaderboards that leave the device.
- **No external AI APIs.** No Gemini, no OpenAI, no Anthropic, nothing. Grading and reports are
  deterministic client-side logic (see `PROJECT.md`).
- **No localStorage for student data.** The school rejected localStorage. Student state goes through
  `RTStore` (sessionStorage backend, swappable to memory). The only localStorage key allowed is
  `rt-theme` (UI preference). The only other browser storage keys are `rt-state`, `rt-stl-model`, and
  `rt-nav` in sessionStorage — all documented in `AUDIT.md`.
- **No third-party scripts loaded at runtime.** Three.js and fonts are vendored under `vendor/` and
  `assets/fonts/`. Before adding any dependency, confirm it makes zero outbound requests at runtime;
  vendor it, read it, record its hash and license in `vendor/README.md` and `AUDIT.md`.
- **Never execute student code.** The code checker is regex/string matching only: no `eval`,
  `new Function`, workers, iframes, or uploads.

## Definition of "student data" for this project

Treat all of the following as student data — anything in this list must only ever exist in the
student's browser (memory, sessionStorage) or in a file the student explicitly exports:

- identity: name, email, team name, team number, any ID that could map back to a person
- activity: practice runs, driver stats, times, scores, streaks, attempts
- answers: theory answers, code submissions, reflections, quiz responses
- derived: BKT mastery estimates, reports, rankings, anything computed from the above
- device/session: timestamps of use, IP, user agent — do not collect even if "harmless"

If you are unsure whether something is student data, it is.

## Verification gates (run at the end of every phase)

```bash
# 1. No banned services referenced anywhere in the codebase (quote the globs — zsh expands them otherwise)
grep -rniE "firebase|firestore|gemini|generativelanguage|googleapis|cloudfunctions|onAuthStateChanged|signIn|apiKey" \
  --include='*.js' --include='*.html' --include='*.json' --include='*.toml' --include='*.css' . \
  | grep -v node_modules | grep -v '^./vendor/'

# 2. No outbound calls in application code (review every hit by hand; each must be annotated in AUDIT.md)
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|new Image\(" \
  --include='*.js' . | grep -v node_modules | grep -v '^./vendor/'

# 3. No leftovers from v1's auth/Firestore layer
grep -rnE "rtUser|rtDb|rtAuth|initAuth|serverTimestamp|netlify/functions|rtUserRole|rtUserTeamId" \
  --include='*.js' --include='*.html' . | grep -v node_modules

# 4. No student-code execution
grep -rnE "\beval\(|new Function|new Worker|importScripts" --include='*.js' --include='*.html' . \
  | grep -v node_modules | grep -v '^./vendor/'

# 5. Tests (self-contained: playwright.config.js starts tests/serve.js)
npm test
npm run test:unit
```

Gate 1 must return nothing. Gate 2 hits must each be annotated in `AUDIT.md` with why they are safe
(e.g. "loads the local field image from `assets/`"). `tests/network-audit.spec.js` intercepts all
network requests during a full student session and asserts every one is a same-origin GET with no
query string and no body.

## Tech stack (v2)

- **Frontend:** Vanilla HTML/CSS/JavaScript. No framework, no bundler, no build step.
- **Scripts:** plain `<script src>` files that expose globals from IIFEs (`window.RTStore`,
  `window.renderLessons`, …). **Not** ES modules — the whole codebase uses classic scripts and `var`.
- **3D:** Three.js r128 vendored at `vendor/three/`.
- **State:** `js/schema.js` (`RTSchema`: shape, versions, migration, import validation) and
  `js/store.js` (`RTStore`: load/get/update/save/clear/export/import; backends: sessionStorage, memory).
- **Grading:** `js/grader.js` (rubric grader for theory), `js/code-check.js` (structural code checker),
  `js/bkt.js` (Bayesian Knowledge Tracing), `js/report.js` + `js/report-templates.js` + `js/charts.js`.
- **Driver rating:** `js/level-table.js` (par time, difficulty weight and focus per level) and
  `js/driver-rating.js` (pure functions: run score, windowed difficulty-weighted rating, grade).
- **Hosting:** any static host. `netlify.toml` has no build command and no functions.
- **Testing:** Playwright (`tests/*.spec.js`, chromium) + Node's built-in test runner
  (`tests/*.test.js`) for grader fixtures.

## Project structure

```
R-Tracker/
├── index.html                  # Home page (carousel + report bar + first-run panel)
├── pages/
│   ├── teleop.html             # TeleOp driver practice (2D canvas + Three.js 3D view)
│   ├── curriculum.html         # Programming curriculum (phases, quiz, deliverables)
│   ├── pathplanner.html        # Autonomous path planner
│   ├── strategy.html           # Match strategy planner
│   ├── report.html             # Progress report
│   └── about.html              # About + privacy statement
├── js/
│   ├── schema.js               # RTSchema — state shape, LIMITS, migrate, validateImport
│   ├── store.js                # RTStore — the only persistence layer
│   ├── grader.js               # gradeTheoryAnswer()  (Phase 4; stub until then)
│   ├── code-check.js           # checkCode(), getPhaseRequirements()  (Phase 5; stub until then)
│   ├── bkt.js / report.js / report-templates.js / charts.js   (Phase 3)
│   ├── level-table.js          # per-level par time, difficulty weight, focus (rating input)
│   ├── driver-rating.js        # RTDriverRating — run score, windowed rating, grade (pure)
│   ├── sidebar.js              # Sidebar nav, theme toggle, Export/Import progress
│   ├── curriculum/
│   │   ├── lessons.js          # Lesson content (Phases 1-5, Advanced, Capstone) + renderer
│   │   └── code-rules.js       # Per-phase structural rules (Phase 5)
│   ├── teleop/                 # field, robot, drive, timer, input, metrics, levels, coach, view3d, ui
│   ├── pathplanner/            # canvas, waypoints, animation, codegen, ui
│   ├── strategy.js
│   └── utils/validators.js     # sanitizeHTML/sanitizeCode, isScore/isStars, validatePhasePatch
├── css/                        # global, fonts, sidebar, home, teleop, curriculum, pathplanner, strategy, report, about
├── vendor/three/               # three.min.js, STLLoader.js, OrbitControls.js (r128) + README with hashes
├── assets/                     # decode.webp field image, summit-sky.webp (+ .svg source), fonts/, favicon.svg
├── tools/bake-sky.mjs          # regenerates assets/summit-sky.webp from the .svg (dev only, never at runtime)
├── tests/
│   ├── serve.js                # zero-dependency static server used by playwright.config.js
│   ├── helpers/state.js        # seed/read state, quiz helpers
│   ├── *.spec.js               # Playwright: smoke, network-audit, persistence, report, curriculum, teleop-rating
│   ├── *.test.js               # node --test: grader / code-check / driver-rating fixtures
│   └── fixtures/               # theory-samples.json, driver-runs.json, code-samples/
├── playwright.config.js
├── netlify.toml                # static publish + security headers incl. CSP
├── AUDIT.md                    # running log of every data flow and why it is safe
├── PROJECT.md / PLAN.md        # what and in which order
└── README.md
```

## Key conventions

### JavaScript
- Vanilla JS only. `var`/`function` declarations, IIFEs, globals on `window`. No frameworks, no build
  tools, no ES modules in page scripts (test files under `tests/` are ESM because `package.json` has
  `"type": "module"`).
- All state reads go through `RTStore.get()`; all writes through `RTStore.update(function (s) { … })`.
  Update functions must be trivial (assignments only) — there is no rollback if they throw.
- Timestamps are epoch milliseconds (`Date.now()`).
- **Every user-provided or imported string placed in `innerHTML` MUST be escaped** with `esc()`,
  `sanitizeHTML()`, or `escSidebar()`. Imported `.json` files are untrusted input.
- DOM manipulation via `document.createElement()` and `innerHTML`.

### CSS
- **"Summit Atmosphere" (every page).** A golden-hour summit sky — the baked raster
  `assets/summit-sky.webp`, painted by `#rt-atmosphere` in `css/global.css` at `z-index: -1` (every page
  has `<div id="rt-atmosphere" aria-hidden="true">` right after `#rt-overlay`) — sits behind liquid-glass
  surfaces. Gold `#e8b04b` is the action accent (`--gold`: primary buttons, active nav/tabs/tools,
  progress); burgundy `#800020` stays as the logo mark and as alpenglow in the horizon haze. Tokens live
  in `css/global.css`: surfaces `--glass` / `--glass-nav` / `--glass-tool` (three blurred levels) and
  `--glass-inset` (the flat fill for rows and cards nested inside a blurred surface); `--glass-border`,
  `--glass-highlight`, `--glass-shadow`; text `--text` / `--text-secondary` / `--text-muted` /
  `--text-faint`, and `--text-on-sky` + `--on-sky-shadow` for anything placed directly on the sky; accent
  text `--gold-text` / `--burgundy-text` (darkened on light glass); status `--good` / `--warn` / `--bad` /
  `--info` with `-soft` fills; `--medal-*`; `--chart-*`; `--code-bg` / `--code-text` (code surfaces are
  navy in both themes). Primitives: `.rt-glass*`, `.rt-sheet`, `.rt-button-primary|secondary|ghost`,
  `.rt-input`, `.rt-pill*`, `.rt-modal(-backdrop)`, `.rt-code`, `.rt-stat`, `.rt-card-icon`, `.rt-label`,
  `.is-good|warn|bad|info`. No glows, no gradient text, no emoji — icons are inline SVG from
  `window.RT_ICONS` (`js/sidebar.js`): static markup uses `<span class="rt-icon" data-rt-icon="save">`
  (hydrated on load), scripts use `rtIcon('save')`.
- **Blur budget.** `backdrop-filter` costs a re-blur on every frame of the theme crossfade, so a page
  blurs only its top-level sheets (sidebar, topbar, side panels), a bounded number of cards and one modal.
  Everything repeated inside them (list rows, level cards, quiz options, code lines) is a flat
  `--glass-inset` / `--glass-tool` fill. Nothing between `<body>` and a canvas gets `backdrop-filter` or
  `overflow: hidden` (the TeleOp 3D view walks those ancestors).
- **Theme.** `light` on `<html>` is light glass and is the default a student lands on; removing the class
  gives dark glass. The boot script in every page's `<head>` adds it unless `localStorage['rt-theme']`
  is `'dark'`. Every stylesheet spells the dark variant `html:not(.light)`, and the page stylesheets
  carry no theme blocks at all: they read tokens, and the tokens flip in `global.css`. **A new colour
  goes in as a token with both values, never as a hex in a page stylesheet.** Canvas-drawn colour (charts,
  the 3D scene) is read from the tokens with `getComputedStyle` and re-drawn on the `rt-themechange`
  event that `toggleTheme()` dispatches on `window`.
- Keep the `prefers-reduced-motion` media query support.
- Font: Inter, self-hosted via `css/fonts.css` (variable woff2 in `assets/fonts/`), with a system fallback.
  TeleOp readouts use `font-variant-numeric: tabular-nums`; only code surfaces use a monospace stack.

### Storage (`RTStore`)
- One constant, `RT_STORAGE_BACKEND` in `js/store.js`, selects `'session'` or `'memory'`. Tests can
  override it by setting `window.__RT_BACKEND` before scripts run.
- `schema.js` is the single source of truth for what is stored. If a field is not in
  `createEmptyState()`, it is not stored. Bump `SCHEMA_VERSION` and add a migration when the shape changes.
- Export produces `rtracker-progress-YYYY-MM-DD.json`; import validates with `RTSchema.validateImport`
  and confirms before overwriting.

### Curriculum
- Phase 0: Java quiz (10 MC, 80% to pass, unlocks Phase 1). Phases 1–2: code lessons with MC checks.
  Phases 3–5: theory sections first (written answers, rubric-graded), then code sections. Advanced 1–2:
  reference modules. Capstone: project brief with rubric.
- Theory: each `written_answer` check carries a `rubric` (required concepts with accepted phrasings,
  disqualifiers, threshold, per-concept hints) or `graded: false` ("Reflection — share with your
  mentor"). Pass = `score >= 70`.
- Code: `checkCode(phaseId, code)` runs the per-phase rules in `js/curriculum/code-rules.js` and returns
  `{ status, passed, score, summary, strengths, issues, requirements_met, next_steps }`. Auto-verify
  needs `status === 'graded' && passed && score >= 75`. It is a structural check, and the UI says so.
- A `submitted` deliverable (submit for mentor review) unlocks the next phase but is never shown as
  "verified".
- Every graded check appends to `curriculum.attempts`; BKT reads only `graded: true` events.

### TeleOp
- 2D canvas: 144x144 inch FTC field with game elements. 3D view: Three.js, replaces the 2D canvas
  in-place (same parent container). Input: Gamepad API + keyboard (WASD + arrows), listeners on
  `document`. 12 levels across 4 tiers with star ratings.
- The driver coach is rule-based (`js/teleop/coach.js`), not an LLM. Reports persist to
  `driver.coachReports`.
- **Driver rating measures outcomes, not style.** Every level attempt appends a run record to
  `driver.runs` (`levelId, sessionId, completed, timeMs, pathAccuracy, collisions, atSpeedFraction,
  styleMetrics, physics, rated, timestamp`). `js/driver-rating.js` scores a run from time against par
  (`js/level-table.js`; par = 70, 1.5× par = 100, 0.5× par = 20), times `(pathAccuracy/100)^0.5`, minus
  5 per wall hit; a failed run is 0. The Overall Rating is the difficulty-weighted mean of each level's
  best 3 run scores over the last 5 sessions (`window.RT_RATING_SESSIONS` overrides), over levels with
  at least one completed run. Grades: S 95, A 85, B 75, C 65, D 50. Runs driven at non-default physics
  (the Free Drive sliders) are stored with `rated: false` and excluded. Par times are `estimated`
  placeholders (1.2 × an expert estimate from path length); replace them with measured times.
- **Style metrics are diagnostics.** Smoothness, stability, strafe, turn precision and recovery are
  sampled only at ≥ 60% of max speed and weighted by speed/max (`js/teleop/metrics.js`). Under 20% of
  moving time at speed they read "insufficient data" (`null` in `driver.stats`). Turn precision is
  overshoot: degrees the driver corrects back within 1.2 s of releasing a ≥ 60% turn, capped at the
  coast (0° → 100, 30°+ → 0). They appear under "Why" on the Report Card and never feed the rating.
  Wall hits are detected in `metrics.js` from the boundary clamp (impact ≥ 1.5 ft/s, once per contact,
  excused within reach of a checkpoint). `drive.js`, `robot.js`, `input.js`, `view3d.js` and the level
  paths were not changed for this.

## Testing
- `npm test` runs Playwright; `playwright.config.js` starts `tests/serve.js` on `http://127.0.0.1:5501` (its own port, so VS Code Live Server on 5500 never interferes).
  `npm run serve` starts the same server for manual use. `npm run test:unit` runs fixture tests.
- Tests navigate with `page.goto`, never by clicking sidebar links (the page-transition script delays
  navigation). Wait on app globals with `waitForFunction`, never on `networkidle`.

## Working style
- Small, reviewable diffs. One phase per branch/commit set, tagged on completion (`v2-phase-N`).
- When you remove a feature, remove its navigation entry, its page, its tests, and its CSS. No dead
  links, no orphan files.
- When something in the old codebase is unclear, read `git show v1-final:<path>`. The full history of
  how it works is in Ekansh's head and the old chat logs, not in comments — ask before guessing at intent.
- Update `AUDIT.md` as part of every phase, not at the end.
- Do not "improve" features outside the current phase's scope. Log ideas in `PLAN.md` under *Deferred*.

## Common gotchas
- The page-transition script intercepts all `<a>` clicks — new navigation must use `<a href>` tags; it
  skips links with a `download` attribute or a `blob:` href (used by Export).
- `store.js` and `schema.js` are loaded non-deferred in `<head>` so every later script can call
  `RTStore.get()` synchronously. Keep that order.
- The 3D view uses `overflow: visible` on canvas ancestors — don't add `overflow: hidden` to parents.
- `sessionStorage` (≈5 MB) is shared by `rt-state` and the STL cache; `RTStore.save()` has a quota
  fallback chain. Don't add large blobs to state.
- `beforeunload` prompts only when state is dirty **and** `rt-nav` is not set (in-app navigation sets it).

## What "done" looks like

A static site that can be deployed to any static host, that a school IT admin can verify in ten minutes
by opening DevTools → Network, using the app for a full session, and seeing zero requests that contain
student input. Everything a student does lives in their browser tab or in a `.json` file they chose to
download.
