# AUDIT.md — data-flow log

Updated at the end of every phase in `PLAN.md`. This file answers one question for a school IT reviewer:
**where can student data go, and why is each path safe?**

## Claim

The deployed site is static. Every request the browser makes is a same-origin GET for a file in this
repository. No request ever carries student input. This is enforced by a Content-Security-Policy
(`netlify.toml` header, an identical `<meta http-equiv>` on every page, and `tests/serve.js` in tests)
and proven by `tests/network-audit.spec.js`, which scripts a full student session (home → teleop level →
path planner save → strategy save → quiz → theory answer → report → about) and asserts that every
request is same-origin, `GET`, has no query string and no body.

## Status

| Phase | State | Tag |
|---|---|---|
| 0 — freeze v1, docs, fixtures | done 2026-09-01 | `v1-final` |
| 1 — kill the network | done 2026-09-01 | `v2-phase-1` |
| 2 — local persistence (sessionStorage backend, export/import) | pending | |
| 3 — report without Gemini | pending | |
| 4 — theory grading without Gemini | pending | |
| 5 — code checkpoints without Gemini | pending | |

## Storage keys (after Phase 1)

`RT_STORAGE_BACKEND = 'memory'` in `js/store.js`: application state lives in a JavaScript variable and is
lost on reload. Phase 2 switches it to `sessionStorage`.

| Key | Where | Contents | Lifetime | Student data? |
|---|---|---|---|---|
| `rt-theme` | localStorage | `"dark"` or `"light"` | device | no — UI preference |
| `rt-nav` | sessionStorage | `"1"` for ~150 ms during an in-app page transition | milliseconds | no |
| `rt_stl_model` | localStorage | base64 of an optional robot STL model uploaded for the 3D view | device | no (a CAD file, not about the student) — moves to sessionStorage in Phase 2 |

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

Grading is stubbed: `js/grader.js` and `js/code-check.js` return `status: 'ungraded'`. Nothing auto-passes.
A student can mark a deliverable **submitted** (for a mentor to read from their exported file), which unlocks
the next phase but is never displayed as verified.

## Third-party code shipped (vendored, read, no runtime network)

- three.js r128 (MIT): `vendor/three/three.min.js`, `STLLoader.js`, `OrbitControls.js` — SHA-256 in `vendor/three/SHA256SUMS`, sources in `vendor/README.md`.
- Inter variable font (SIL OFL 1.1): `assets/fonts/InterVariable.woff2`, license in `assets/fonts/OFL.txt`.

## Export file

Phase 2. `rtracker-progress-YYYY-MM-DD.json` will contain the full `RTStore` state (see `js/schema.js`) and is
created only when the student clicks Export.
