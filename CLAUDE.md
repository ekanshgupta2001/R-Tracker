# CLAUDE.md — R-Tracker Project Guide

## Project Overview
R-Tracker is a browser-based FTC (FIRST Tech Challenge) robotics platform for Team 25702 Rundle Robotics Castle. It provides driver practice simulation, programming curriculum with AI grading, path planning, strategy planning, and team management.

**Live URL:** https://r-tracker-liard.vercel.app
**GitHub:** github.com/ekanshgupta2001/R-Tracker (main branch)
**Firebase Project:** r-tracker-646c3

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript (NO framework)
- **3D Rendering:** Three.js r128
- **Authentication:** Firebase Auth (Google OAuth + email/password)
- **Database:** Cloud Firestore (NoSQL)
- **AI:** Google Gemini 2.5 Flash (proxied through Vercel serverless function)
- **Server Functions:** Vercel Serverless Functions (Node.js, ESM imports)
- **Hosting:** Vercel (auto-deploys on push to main)
- **Testing:** Playwright (11 smoke tests)

## Project Structure
```
R-Tracker/
├── index.html                  # Home page with role-aware carousel
├── pages/
│   ├── teleop.html             # TeleOp driver practice
│   ├── curriculum.html         # Programming curriculum
│   ├── pathplanner.html        # Autonomous path planner
│   ├── strategy.html           # Match strategy planner
│   ├── report.html             # Driver report card
│   ├── dashboard.html          # Coach dashboard
│   ├── manage-team.html        # Team management
│   └── about.html              # About page
├── js/
│   ├── firebase-init.js        # Firebase initialization
│   ├── firebase-auth.js        # Auth flow, role selection overlay
│   ├── sidebar.js              # Sidebar navigation, theme toggle
│   ├── curriculum/
│   │   ├── lessons.js          # All lesson content (Phases 1-5 + theory)
│   │   └── gemini.js           # AI review client (calls /api/review)
│   ├── teleop/
│   │   ├── simulator.js        # 2D field canvas, physics, input handling
│   │   └── view3d.js           # Three.js 3D field view
│   ├── pathplanner/            # Path planner logic
│   ├── strategy.js             # Strategy planner canvas tools
│   └── utils/
│       ├── validators.js       # Input validation functions
│       └── storage.js          # Firestore read/write helpers
├── css/
│   ├── global.css              # Global styles, transitions, theme
│   ├── teleop.css              # TeleOp-specific styles
│   └── [feature].css           # Per-feature stylesheets
├── api/
│   ├── review.js               # Gemini AI proxy (serverless function)
│   ├── join-team.js            # Server-side invite code validation
│   └── set-role.js             # Server-side role assignment
├── tests/
│   └── smoke.spec.js           # Playwright smoke tests
├── build.sh                    # Generates config.js from env vars
├── vercel.json                 # Vercel config (headers, routes, functions)
├── firestore.rules             # Firestore security rules
├── .vercelignore               # Files excluded from deployment
├── config.js                   # GITIGNORED — generated at build time
├── config.example.js           # Template showing config structure
├── 404.html                    # Custom 404 page
└── robots.txt                  # Search engine directives
```

## Key Conventions

### JavaScript Style
- Vanilla JS only — no React, no frameworks, no build tools
- Use `var` or `function` declarations for broad browser compatibility
- Firebase uses compat SDK (v9 compat): `firebase.auth()`, `firebase.firestore()`
- DOM manipulation via `document.createElement()` and `innerHTML`
- All user-provided strings in innerHTML MUST be wrapped in `sanitizeHTML()`, `esc()`, or `escSidebar()`

### CSS Style
- Color scheme: burgundy (#800020) + matte black (#1a1a1a) + white
- Accent color: #c73e5a (brighter rose for borders, text, thin lines)
- Hover accent: #d4456a
- Light mode: `.light-mode` class on `<html>`, with overrides in each CSS file
- All CSS changes must include light-mode variants

### Serverless Functions (api/)
- Use ESM imports (`import admin from 'firebase-admin'`)
- Every endpoint MUST verify Firebase ID token via `admin.auth().verifyIdToken()`
- Origin validation uses exact match (`===`), NOT `startsWith()`
- Allowed origins: `https://r-tracker-liard.vercel.app`, `http://localhost:5500`, `http://127.0.0.1:5500`
- Rate limiting tracked in Firestore `rateLimits` collection (admin SDK bypasses rules)
- The `GEMINI_API_KEY` lives ONLY in Vercel environment variables — NEVER in client code

### Firestore Security Rules
- Users can read/write their own data under `users/{userId}`
- `role` and `teamId` fields are LOCKED from client-side writes — only serverless functions (admin SDK) can set them
- Score fields validated: 0-100 for scores, 0-3 for stars, 0-20 for levels
- Rate limit docs are increment-only (cannot be reset by users)
- Team members/strategies/activity restricted to team members only
- Rules must be manually deployed: Firebase Console → Firestore → Rules → Publish

### Config & Environment Variables
- `config.js` is gitignored and generated by `build.sh` at deploy time
- Vercel environment variables: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`
- The `FIREBASE_SERVICE_ACCOUNT` is a full JSON service account key used by serverless functions

## Curriculum Structure
- **Phase 0:** Java quiz (10 MC questions, 80% to pass, auto-unlocks Phase 1)
- **Phases 1-2:** Code-only lessons with MC check questions
- **Phases 3-5:** Theory sections first (written answers, AI graded), then code sections
- **Advanced 1-2:** Reference documents
- **Capstone:** Project brief with rubric
- Theory answers require minimum 50-80 characters, graded by Gemini with strict rubric
- Code review requires 75+ score to pass
- Section locking: theory → code → deliverable (sequential unlock)

## AI Integration
- All Gemini calls go through `/api/review` serverless function
- Client sends: `{ prompt, type }` with Firebase auth token in Authorization header
- Types: `code_review`, `theory_review`
- Server-side rate limits: 10/user/day, 2/user/minute, 230/global/day
- Prompts include anti-injection protection
- Model: `gemini-2.5-flash` via v1beta endpoint
- Temperature: 0.1, maxOutputTokens: 8192

## TeleOp Simulator
- 2D canvas: 144x144 inch FTC field with game elements
- 3D view: Three.js, replaces 2D canvas in-place (same parent container)
- Input: Gamepad API + keyboard (WASD + arrows), listeners on `document`
- Physics: mecanum/tank drive, field-centric/robot-centric modes
- 12 levels across 4 tiers with star ratings
- AI driver coach: rule-based metrics (NOT Gemini), generates scores and profiles

## Deployment
- Push to `main` → Vercel auto-deploys
- `build.sh` generates `config.js` from Vercel env vars
- Firestore rules deployed manually via Firebase Console
- `.vercelignore` blocks sensitive files from deployment
- Security headers set in `vercel.json`

## Testing
- Run: `npm test` (requires Live Server running on localhost:5500)
- 11 Playwright smoke tests in `tests/smoke.spec.js`
- Start Live Server in VS Code before running tests

## Common Gotchas
- Firestore rules changes require manual deployment in Firebase Console — they don't auto-deploy
- `config.js` must exist locally for development (copy from `config.example.js` and fill in values)
- For local serverless function testing, use `vercel dev` instead of Live Server
- The 3D view uses `overflow: visible` on canvas ancestors — don't add `overflow: hidden` to parent containers
- The page transition script intercepts all `<a>` clicks — new navigation patterns must use `<a href>` tags
- Firebase compat SDK syntax: `firebase.firestore()` not `getFirestore()`
- All `innerHTML` assignments with user data MUST use `sanitizeHTML()` / `esc()` / `escSidebar()`
- Never reference `GEMINI_API_KEY` in client-side code — it only exists server-side

## Important Do-Nots
- Do NOT add `GEMINI_API_KEY` to any client-side file
- Do NOT use `startsWith()` for origin checks in serverless functions
- Do NOT allow users to write `role` or `teamId` from client-side code
- Do NOT skip XSS sanitization on any user-provided content in innerHTML
- Do NOT read image files when making changes (screenshots are described in conversation)
- Do NOT change the Firebase compat SDK to modular SDK
- Do NOT add frameworks (React, Vue, etc.) — this is vanilla JS intentionally
- Do NOT remove the `prefers-reduced-motion` media query support
