# R-Tracker (v2)

A browser-based training platform for FTC teams, built by Team 25702 Rundle Robotics Castle:
driver-practice simulator (2D + Three.js 3D), autonomous path planner, match strategy planner,
an FTC programming curriculum with theory and code checkpoints, and a progress report.

**v2 is a static site that keeps every byte of student data in the student's browser.** No accounts,
no database, no AI service, no server. Progress lives in the browser tab and in a `.json` file the
student exports. See `PROJECT.md` (why), `PLAN.md` (how, phase by phase) and `AUDIT.md` (proof).

## Run it locally

```bash
npm install
npm run serve          # http://127.0.0.1:5500  (zero-dependency static server, tests/serve.js)
```

Any static file server works; the site has no build step.

## Tests

```bash
npx playwright install chromium   # once
npm test                          # Playwright: smoke + network audit (+ persistence, report … as phases land)
npm run test:unit                 # node --test: grader / code-check fixtures (Phases 4–5)
```

`tests/network-audit.spec.js` scripts a full student session and asserts every request is a
same-origin GET with no query string and no body. That test is the demo for the school.

## Structure

```
index.html, pages/*.html      the app (vanilla HTML/CSS/JS, no framework)
js/schema.js, js/store.js     RTSchema (what is stored) and RTStore (the only persistence layer)
js/grader.js, js/code-check.js  local, deterministic grading (stubs until Phases 4–5)
js/teleop/, js/pathplanner/   simulator and planner modules
js/curriculum/lessons.js      curriculum content + lesson renderer
vendor/, assets/fonts/        three.js r128 and the Inter font, self-hosted
tests/                        Playwright specs, static server, fixtures
netlify.toml                  static publish + security headers (CSP)
```

## Conventions

Read `CLAUDE.md` before changing anything: hard constraints (no network calls, no auth, no localStorage
for student data), the verification gates, and the CSS/JS conventions.

## Deploy

Push `main` (v1, frozen at the `v1-final` tag) or `v2` to Netlify with `netlify.toml`. No environment
variables, no functions.
