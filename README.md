# R-Tracker (v2)

A browser-based training platform for FTC teams, built by Team 25702 Rundle Robotics Castle:
driver-practice simulator (2D + Three.js 3D), autonomous path planner, match strategy planner,
an FTC programming curriculum with theory and code checkpoints, and a progress report.

**v2 is a static site that keeps every byte of student data in the student's browser.** No accounts,
no database, no AI service, no server. Progress lives in the browser tab and in a `.json` file the
student exports. `tests/network-audit.spec.js` is the proof: it scripts a full student session and
asserts that every request the browser makes is a same-origin GET for a static file, with no query
string and no body.

## Run it locally

```bash
npm install
npm run serve          # http://127.0.0.1:5500  (zero-dependency static server, tests/serve.js)
```

Any static file server works; the site has no build step.

## Tests

```bash
npx playwright install chromium   # once
npm test                          # Playwright: smoke, network audit, persistence, curriculum, report, code check, TeleOp rating
npm run test:unit                 # node --test: rubric grader, code checker, driver rating, drive physics
```

## Structure

```
index.html, pages/*.html        the app (vanilla HTML/CSS/JS, no framework)
js/schema.js, js/store.js       RTSchema (what is stored) and RTStore (the only persistence layer)
js/grader.js, js/code-check.js  local, deterministic grading of theory answers and code checkpoints
js/teleop/, js/pathplanner/     simulator and planner modules
js/curriculum/lessons.js        curriculum content + lesson renderer
vendor/, assets/fonts/          three.js r128 and the Inter font, self-hosted
tests/                          Playwright specs, static server, fixtures
tools/                          dev-only scripts: bake the sky art, estimate TeleOp par times
```

## Rules

Every change keeps these true; the tests check most of them.

- **No request carries student data.** The only network activity is same-origin GETs of static
  files. The `<meta http-equiv="Content-Security-Policy">` on every page sets `connect-src 'none'`,
  and `tests/serve.js` sends the same policy as a header for local runs.
- **No accounts, no server-side storage, no external AI.** Grading and reports are deterministic
  client-side logic.
- **No localStorage for student data.** State goes through `RTStore` (sessionStorage keys `rt-state`,
  `rt-stl-model`, `rt-nav`). The only localStorage key is `rt-theme`, a UI preference.
- **No third-party scripts at runtime.** Vendor them under `vendor/` and record the hash and licence
  in `vendor/README.md`.
- **Never execute student code.** The code checker is string matching only: no `eval`,
  `new Function`, workers or iframes.
- **Escape every user-provided or imported string** before it reaches `innerHTML`.

## Deploy

Copy the repository to any static host; there is no build step and no environment variable. The
security policy is the CSP `<meta>` on every page, and `404.html` is the not-found page.
