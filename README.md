# R-Tracker — FTC Driver Practice, Path Planning, and Programming Curriculum

![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Google%20Gemini-AI%20Code%20Review-4285F4?logo=google&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E%20Tests-2EAD33?logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

A browser-based platform for FTC robotics teams to practice driving, plan autonomous paths, and learn programming through an AI-powered interactive curriculum.

Built for the **2025-2026 DECODE** season.

---

## Features

**Driver Training**
- **TeleOp Practice** — Canvas-based DECODE field simulator with gamepad and keyboard input, mecanum and tank drivetrains, field-centric and robot-centric modes, realistic physics with momentum, friction, and wall collisions
- **Gamified Levels** — 12 progressive driving challenges across 4 difficulty tiers with Gold/Silver/Bronze star ratings, path corridors, ghost indicators, and countdown timers
- **AI Driver Coach** — Real-time performance metrics, driver profiles, scoring history, and AI-powered training recommendations

**Autonomous Tools**
- **Path Planner** — Visual path designer with Bezier curves, draggable control points, robot preview animation, and one-click Pedro Pathing Java code export

**Learning**
- **Programming Curriculum** — 6-phase interactive course (Java basics through competition-ready code) with progressive section unlocking, multiple-choice knowledge checks, syntax-highlighted code examples, and mentor tips
- **AI Code Review** — Automated deliverable grading via Google Gemini 2.5 Flash with per-requirement scoring, strengths/issues breakdown, and actionable next steps
- **Advanced Modules** — Optional deep dives into command-based programming and competition strategy engineering
- **Capstone Project** — Full competition autonomous build with categorized requirements and grading rubric

**Team & Platform**
- **Team Management** — Coach and player roles, team creation, invite codes, roster management, and student progress tracking
- **Team Dashboard** — Driver rankings, performance comparisons, and AI-powered primary/secondary driver recommendations
- **Driver Reports** — Per-player stats, AI coaching analysis, and performance history
- **Firebase Integration** — Google and email authentication, Firestore persistence, real-time sync across devices
- **Light/Dark Mode** — System-wide theme toggle across all pages

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML, CSS, JavaScript — zero framework dependencies |
| **Backend** | Firebase Authentication, Cloud Firestore |
| **AI** | Google Gemini 2.5 Flash (automated code review) |
| **Testing** | Playwright end-to-end tests |
| **Hosting** | Firebase Hosting |

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/ekanshgupta2001/ftc-driver-sim.git
cd ftc-driver-sim

# Set up configuration
cp config.example.js config.js
# Edit config.js — add your Firebase project credentials and Gemini API key

# Install test dependencies (optional)
npm install
npx playwright install chromium

# Start a local server (VS Code Live Server recommended, port 5500)
# Then open http://localhost:5500
```

Sign in with Google or email, and you're ready to go.

---

## Project Structure

```
ftc-driver-sim/
├── index.html              # Home dashboard
├── config.example.js       # Template for API keys (copy to config.js)
├── pages/
│   ├── teleop.html         # TeleOp driving simulator
│   ├── pathplanner.html    # Autonomous path planner
│   ├── curriculum.html     # Programming curriculum
│   ├── report.html         # Driver report & stats
│   ├── dashboard.html      # Team dashboard (coaches)
│   ├── manage-team.html    # Team management (coaches)
│   └── about.html          # Project info & credits
├── js/
│   ├── auth.js             # Authentication flow
│   ├── sidebar.js          # Navigation & theme toggle
│   ├── firebase-init.js    # Firebase initialization
│   └── curriculum/
│       ├── lessons.js      # Interactive lesson content & renderer
│       └── gemini.js       # AI code review via Gemini API
├── css/
│   ├── global.css          # Shared styles & theme variables
│   ├── home.css            # Home dashboard styles
│   ├── sidebar.css         # Navigation styles
│   ├── curriculum.css      # Curriculum page styles
│   └── report.css          # Driver report styles
├── tests/
│   └── smoke.spec.js       # Playwright smoke tests
└── functions/              # Firebase Cloud Functions (scaffolded)
```

---

## Running Tests

```bash
# Headless (CI)
npm run test:ci

# Headed (local development)
npm test
```

Tests require a local server running on port 5500.

---

## Built By

**Ekansh Gupta** — Lead Programmer, FTC Team 25702 Rundle Robotics Castle

Built for **50+ students across 5 FTC teams** in the Rundle Robotics program.

---

## License

[MIT](LICENSE)
