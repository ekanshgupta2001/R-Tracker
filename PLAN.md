# PLAN.md — R-Tracker v1 → v2 migration

> ## Amendments (2026-09-01, before Phase 1 started)
>
> Decisions made when implementation began. They override the matching lines below.
>
> 1. **Same repo, `v2` branch.** v2 is built on the `v2` branch of this repository instead of a copied
>    `r-tracker-v2/` folder. The frozen v1 is the `v1-final` tag (also `main` until merge). Read it with
>    `git show v1-final:<path>`. Per-phase rollback points are the `v2-phase-N` tags.
> 2. **School answers:** localStorage on school devices — **no**. Student-exported `.json` — **yes**.
>    Mentor file-picker view — not yet answered (Phase 6 stays deferred).
> 3. **Storage backend is `sessionStorage`, not localStorage.** Tab-scoped, survives reload and same-tab
>    navigation, wiped on tab close. `MemoryBackend` remains the one-constant swap. The theme preference
>    `rt-theme` stays in localStorage as a UI setting (not student data; see `AUDIT.md`).
> 4. **The storage module is `js/store.js` (`RTStore`) with `js/schema.js` (`RTSchema`)**, introduced in
>    Phase 1 with the memory backend so every Firestore call site is rewired once; Phase 2 adds the
>    sessionStorage backend, migrations, import validation and the Export/Import UI.
> 5. **Coach dashboard, manage-team, team activity, leaderboards and the Gemini client are deleted in
>    Phase 1**, not Phase 6: they cannot work without Firestore, the grep gate must be clean by Phase 2,
>    and `CLAUDE.md` forbids orphan files. `v1-final` is the rollback.
> 6. **Plain `<script>` globals, not ES modules.** The codebase uses classic scripts and IIFEs; v2 keeps
>    that. Test files are ESM because `package.json` has `"type": "module"`.
> 7. **Grader stubs ship under their final names** (`js/grader.js`, `js/code-check.js`) from Phase 1 and
>    return `{ status: 'ungraded' }`; nothing auto-passes. Until Phase 4/5 land, a `submitted`
>    deliverable unlocks the next phase but is never shown as "verified".
> 8. **Theory fixture** (`tests/fixtures/theory-samples.json`, 52 samples) was drafted by Claude from the
>    lesson content and needs a human spot-check before Gate 4 is trusted.
>
> **Status (2026-09-01):** Phases 0–5 complete on the `v2` branch, tags `v2-phase-1` … `v2-phase-5`.
> Phases 6–7 not started. Gate results are recorded in `AUDIT.md`.
>
> ### Deferred additions
> - Auto-download an export on milestones (browsers throttle repeated downloads; a toast nudge is used instead).
> - Extract the ~1.3k-line inline script in `pages/curriculum.html` to `js/curriculum/app.js`.
> - Flatten the `savePhaseData(...).then(...)` chains now that saves are synchronous.
> - Salvage the canvas radar chart for the Phase 3 report from `git show v1-final:pages/dashboard.html` (lines 1018-1094).


Principle: **the app is runnable and demoable at the end of every phase.** Each phase removes or
replaces one thing, then proves it with a gate. If a gate fails, fix it before moving on; do not
carry debt forward. Every phase is its own branch and tag so any phase can be revisited.

Legend: 🔒 = gate (must pass) · ⏪ = rollback point

---

## Phase 0 — Freeze, copy, and pin down the rules

Nothing technical is worth doing until decision 1 in `PROJECT.md` is answered in writing.

1. Tag the original repo: `git tag v1-final` and push. This is the "proof it worked with an LLM"
   snapshot and the fallback if the school changes its mind. **Never commit to it again.**
2. Copy the folder to `r-tracker-v2/` and init it as its own repo (`git init`, first commit
   = "v1 snapshot"). Copying the folder rather than branching is fine; it keeps the two
   mentally separate. Keep both.
3. Drop `CLAUDE.md`, `PROJECT.md`, `PLAN.md`, and an empty `AUDIT.md` into `r-tracker-v2/`.
4. Email the school with three yes/no questions (verbatim from PROJECT.md Open Decisions):
   - Is data stored only in the browser on a school device acceptable?
   - Is a file the student exports and keeps themselves acceptable?
   - Would a mentor view that reads those files (nothing stored) be acceptable?
   Include the one-line privacy statement: *"The app is a set of static files. Nothing a
   student enters is ever transmitted; it exists only in their browser, or in a file they
   choose to download."*
5. Write the theory-grading regression set now while the old Gemini-graded questions are fresh:
   ~50 sample answers across the existing theory questions, each hand-labeled correct/partial/
   incorrect. Save as `tests/fixtures/theory-samples.json`. This becomes the yardstick for
   Phase 4 and doesn't depend on any school decision.

🔒 Gate 0: `v1-final` tag exists · v2 repo has its own first commit · fixtures file exists ·
school questions sent. Do not start Phase 1 before the localStorage answer comes back unless
you're willing to build the storage layer swappable (which you should anyway — see Phase 2).

⏪ Rollback: none needed; nothing changed.

---

## Phase 1 — Kill the network

Goal: the app makes zero requests to Firebase, Gemini, or any third party, and still loads.
Features that depended on them are stubbed, not fixed yet.

1. Remove Firebase SDK imports, `config.js` keys, Cloud Functions folder, `firebase.json`,
   `.firebaserc`, security rules.
2. Remove every Gemini call site. Replace each with a stub that returns a clearly-labeled
   placeholder (`{ status: "ungraded", reason: "grader not implemented" }`) so the UI still
   renders.
3. Remove auth: delete login/signup pages, auth guards, `onAuthStateChanged` listeners. The app
   opens straight to the player home.
4. Remove team join, leaderboards, and the mentor dashboard from navigation (leave the files
   for now; delete in Phase 6).
5. Add the network-audit Playwright test: intercept all requests during a scripted full session
   (open app → teleop practice → path planner → open a lesson → answer a theory question →
   view report) and assert every request is a same-origin GET for a static asset.
6. Start `AUDIT.md`: list every remaining `fetch`/network hit and why it's safe.

🔒 Gate 1: grep gate from `CLAUDE.md` returns nothing for firebase/gemini/auth · network-audit
test passes · app loads with no console errors · teleop and path planner work as before.

⏪ Rollback: `git tag v2-phase-1`. Reverting to `v1-final` restores everything.

---

## Phase 2 — Local persistence

Goal: progress survives a reload, and the storage backend is swappable.

1. Write `js/storage.js` with a single interface: `load()`, `save(state)`, `clear()`,
   `export()`, `import(json)`. Two implementations behind it: `LocalStorageBackend` and
   `MemoryBackend`. A single constant picks which one. This is the one-file swap if the school
   rejects localStorage.
2. Define the state schema in `js/schema.js` with a `version` field and a migration function.
   Everything the app remembers about a student goes through this — driver stats, curriculum
   progress, answers, BKT params, report history. If it isn't in the schema, it isn't stored.
3. Rewire every former Firestore read/write to `storage.js`. Search for the old collection
   names (`users/`, `teams/`, `curriculum-progress`) to find them all.
4. Add Export (downloads `rtracker-progress-<date>.json`) and Import (file picker, validates
   schema version, confirms before overwrite) to the sidebar. Add a "last exported" indicator
   and a nag if it's been > N sessions.
5. Playwright: complete an action → reload → state persists; export → clear → import → state
   identical; switch to `MemoryBackend` → reload → state gone (proves the swap works).

🔒 Gate 2: all three persistence tests pass · full grep gate from `CLAUDE.md` returns nothing ·
`AUDIT.md` updated with the storage keys in use.

⏪ Rollback: `git tag v2-phase-2`.

---

## Phase 3 — Report without Gemini

Goal: the report page is useful again, driven entirely by local data.

1. Move BKT from the Frontier codebase into `js/bkt.js` (client-side, per module). Feed it the
   existing checkpoint pass/fail history from storage. Parameters (prior, learn, guess, slip)
   live in the curriculum JSON per module so they're tunable without code changes.
2. Build `js/report.js`: a fixed set of sections, each a pure function of state → `{ chart,
   text }`. Sections: driver stats summary, practice consistency, curriculum progress, mastery
   by module, "next step" (lowest-mastery module whose prerequisites are met), streak callouts.
3. Text is rule-based from a template file (`js/report-templates.js`) — conditional sentences,
   not free prose. Keep it short; charts carry the weight.
4. Charts: use whatever v1 already used if it's a local library; otherwise vendor a small
   charting lib or draw with canvas. No CDN that phones home.
5. Playwright: seeded state → report renders every section → no section says "undefined" or
   "NaN" · empty state → report renders a sensible "nothing yet" view.

🔒 Gate 3: report tests pass · report renders in < 1s with a year of seeded data · network-audit
test still passes.

⏪ Rollback: `git tag v2-phase-3`.

---

## Phase 4 — Theory grading without Gemini

Goal: theory checkpoints grade deterministically and feed BKT.

1. Rewrite every theory question in the curriculum to be constrained (short-answer with
   nameable required concepts). For each, author a rubric: required concepts with accepted
   phrasings, disqualifiers, threshold, per-concept hint text. Store in the curriculum JSON
   next to the question.
2. Questions that genuinely can't be constrained: mark `graded: false`, label in UI as
   "reflection — share with your mentor," store locally, exclude from BKT.
3. Build `js/grader.js`: normalize → fuzzy-match each concept (vendor `fuse.js` or write
   Levenshtein) → score → feedback listing missed concepts with their hints.
4. Run the grader against `tests/fixtures/theory-samples.json` from Phase 0. Iterate rubrics
   until agreement with the hand labels is ≥ 90%. Log the disagreements — they tell you which
   questions are still too open.
5. Wire grader output into BKT and the report.

🔒 Gate 4: ≥ 90% agreement on the fixture set · every theory question has either a rubric or
`graded: false` · Playwright: answer a question → feedback shown → mastery updates → report
reflects it.

⏪ Rollback: `git tag v2-phase-4`.

---

## Phase 5 — Code checkpoints without Gemini

Goal: code submissions get immediate, honest, limited feedback.

1. Per lesson, define required patterns (e.g. `hardwareMap.get`, `setPower`, `telemetry.update`)
   and forbidden ones, with hint text per miss. Store in curriculum JSON.
2. `js/code-check.js`: string/regex checks only. **Do not execute student code, do not upload
   it.** Feedback is explicit that this is a structural check, not a correctness check.
3. Submissions are stored locally and included in export so a mentor can actually review them.
4. Playwright: known-good sample passes, known-bad sample gets the right hint.

🔒 Gate 5: tests pass · grep for any `eval`/`new Function`/worker execution of user code returns
nothing.

⏪ Rollback: `git tag v2-phase-5`.

---

## Phase 6 — Mentor view (build last, cut if needed)

Only start this if the school answered yes to Open Decision 3.

1. `mentor.html`: file picker (multi), reads exported `.json` files, validates schema, renders
   each student's report (reuse `report.js`) plus reflections and code submissions for review.
   Team summary table across loaded files.
2. Nothing is written to storage. Refresh clears everything. Say so on the page.
3. Now delete the old mentor dashboard, team, and leaderboard files for good.
4. Playwright: load two fixture exports → both render → reload → empty.

🔒 Gate 6: tests pass · network-audit test passes on `mentor.html` too · `AUDIT.md` complete.

⏪ Rollback: `git tag v2-phase-6`. If the school says no to the mentor view, revert this tag
only; Phases 1–5 are unaffected.

---

## Phase 7 — Approval package

1. Deploy v2 to a static host (Vercel static, GitHub Pages, or Netlify — no serverless functions
   configured).
2. Write `PRIVACY.md` (one page): what the app is, the data table from `PROJECT.md`, the
   DevTools demo steps, the export/import explanation, what a mentor sees and how.
3. Record a two-minute screen capture: DevTools Network tab open, full session, zero
   student-data requests. This is the demo for the approval meeting.
4. Send the package. Keep `v1-final` deployable but unpublished.

🔒 Gate 7: school approval in writing. If they reject, the reasons go into a new Phase 0.

---

## Design pass — Summit Atmosphere (2026-09-02)

Done in two steps: the homepage and shared chrome first, then every other page (teleop, curriculum,
report, strategy, pathplanner, about, 404) re-skinned onto the same tokens — layouts kept, v1 surface
colours, glows and emoji gone, `body.rt-legacy` and every `html.light` page block deleted. Charts and
the 3D scene read their colours from tokens and re-draw on `rt-themechange`. See `AUDIT.md` for the
data-flow check and `CLAUDE.md` › CSS for the conventions (tokens, primitives, blur budget).

## Driver rating rework (2026-09-03)

The TeleOp Overall Driver Rating now measures outcomes, not style: `js/driver-rating.js` scores each
stored level run (`driver.runs`, schema 2) on time against par (`js/level-table.js`), path accuracy
and wall hits, then takes a difficulty-weighted mean of each level's best 3 runs over the last 5
sessions. The old style metrics are diagnostics under "Why" on the Report Card, sampled only at ≥ 60%
of max speed; turn precision is now overshoot after release. The Report Card gained a Level Performance
section and the recommendation starts from the weakest level group. Physics, controls, rendering and
level geometry are untouched. Tests: `tests/driver-rating.test.js` (fixtures a–d),
`tests/teleop-rating.spec.js` (scripted run → stored record → on-screen rating equals the formula).

**Open:** the 12 par times are simulated (`parSource: "simulated"`, see below). Replace them with
measured expert times and flip `parSource` to `"measured"` when the team has driven the levels.

## Realistic drive physics (2026-09-03)

`js/teleop/drive.js` now models a real competitive FTC drivetrain (4 × 435 RPM Yellow Jackets, 96 mm
mecanum, 18 in, ~35 lb, BRAKE mode): 6.5 ft/s loaded top speed, strafe at 80% of forward, 380 °/s
spin in place (190 °/s while driving flat out, since the motors are shared — raised from a first cut
of 270 after driving it), traction-limited 20 ft/s² accel and braking, a 0.2 s first-order motor lag instead of a linear
ramp, and 80 ms control latency. Wheel powers are normalised the way every FTC TeleOp does and the body
velocity is derived from them, so turning while driving slows the robot and a full-stick diagonal is
~35% slower than a straight; velocity is integrated in the robot frame and turns with the body, so a
robot that spins while driving curves like a real one. Every
default is derived in the file header. Because the old 8 ft/s / instant-response robot was faster than
anything real, par times were re-derived by simulating an ideal full-stick driver through the real
`updateBot` (`tools/estimate-pars.mjs`, × 1.2) and each level's time limit is now 2 × par so gold means
par pace. Runs recorded under the old physics stay stored but are no longer rated.

## Deferred (ideas logged during migration — do not build during a phase)

- Browser-side embeddings (Transformers.js) for paraphrase-tolerant grading, if rubrics
  plateau below 90% on some question types.
- Auto-backup: download an export automatically on phase completion.
- QR-code export for phone → laptop transfer without a file.
- **Cloud drift on the homepage sky.** The design drifted six cloud groups inside the atmosphere SVG.
  That cost ~100 fps (19.6 fps idle) because each group sat in an feTurbulence chain, and turbulence is
  defined in user space, so moving a group changes the noise and re-rasterises the whole chain. The sky
  is now a baked raster (`assets/summit-sky.webp`), so motion over it would be cheap again — drift could
  come back as one or two CSS gradient veils inside `#rt-atmosphere` animated with `translate3d`. Left
  out for now: static measured 120 fps with zero dropped frames, and the original drift was 36px over
  90 seconds, which nobody can see.
- **Carousel bleed-through on the homepage.** The neighbours sit ~150px under the 500px centre card, and
  because that card is translucent glass their text reads through it. The container only has room for a
  ±302px step at 1440px (`initCarousel` clamps `SPREAD` to the space available), and clearing the centre
  card entirely would need ±450px, which would clip the neighbours. Levers, both one-liners in
  `initCarousel`: raise `SPREAD` and accept clipped neighbours, or lower the neighbour opacity in
  `place()` from 0.92 toward v1's 0.35 so what shows through is faint. Left as the design has it.

## Kill criteria

If the school rejects both localStorage *and* the export file, the product is a session-only
practice tool. Ship Phases 1, 3 (in-memory), 4, 5 with `MemoryBackend` and stop. Don't spend a
month building a tracker that isn't allowed to track.
