# AUDIT.md — data-flow log

Updated at the end of every phase in `PLAN.md`. This file answers one question for a school IT reviewer:
**where can student data go, and why is each path safe?**

## Claim

The deployed site is static. Every request the browser makes is a same-origin GET for a file in this
repository. No request ever carries student input. This is enforced by a Content-Security-Policy
(`netlify.toml` header, `<meta http-equiv>` copy on every page, and `tests/serve.js` in tests) and proven
by `tests/network-audit.spec.js`.

## Status

| Phase | State | Tag |
|---|---|---|
| 0 — freeze v1, docs, fixtures | done 2026-09-01 | `v1-final` |
| 1 — kill the network | pending | |
| 2 — local persistence | pending | |
| 3 — report without Gemini | pending | |
| 4 — theory grading without Gemini | pending | |
| 5 — code checkpoints without Gemini | pending | |

## Storage keys

Filled in during Phase 1–2. Before Phase 1 the app is still v1 (Firebase + Gemini) and this table does not apply.

| Key | Where | Contents | Lifetime | Student data? |
|---|---|---|---|---|
| `rt-theme` | localStorage | `"dark"` or `"light"` | device | no — UI preference |

## Outbound calls (grep gate 2) and why each is safe

Filled in during Phase 1.

## Third-party code shipped

Filled in during Phase 1 (vendored three.js r128, Inter font) with source URLs, hashes and licenses.

## Export file

Filled in during Phase 2.
