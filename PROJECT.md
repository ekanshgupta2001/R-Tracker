# PROJECT.md — R-Tracker v2

## One-paragraph summary

R-Tracker is a training app for FTC robotics students: driver practice (3D teleop simulator),
path planning, a coding curriculum with theory and code checkpoints, and a progress report.
Version 1 used Firebase Auth + Firestore for accounts/progress and the Gemini API for grading
theory answers and writing the report. The school (a private institution, liable for any student
data exposure) will not approve any version that stores, transmits, or processes student data
on any system other than the student's own device. **v2 is the same product rebuilt so that no
student data ever leaves the browser.** No accounts, no database, no AI API, no server.

## Why this shape (and not something else)

The school's objection is liability for *exposure*, so the design goal is: there is nothing to
expose. A static site that stores state only in the student's browser has the same privacy profile
as a calculator. That is a stronger approval story than "we secured the data" because there is no
data to secure.

Alternatives considered and rejected:

- **Self-hosted model / local server** — technically private, but it still means "our system
  processes student text," which the school has said it won't accept. Dead on arrival.
- **Keep login, drop Gemini** — the login itself is on the school's list. Dead.
- **In-memory only, nothing persisted** — meets the strictest reading but destroys the product
  (a tracker that doesn't track). Held as a *fallback* if the school rejects localStorage; see
  Open Decisions.

## Data model — the whole privacy story

| Where data lives            | What's there                                       | Who can see it              |
|-----------------------------|----------------------------------------------------|-----------------------------|
| Browser memory              | current session state                              | the student, until tab close|
| localStorage / IndexedDB    | progress, stats, mastery, report history           | the student, on that device |
| Exported `.json` file       | a snapshot of the above, on explicit "Export" click| whoever the student gives it to |
| Server                      | **nothing** — static files only                     | n/a                         |

Nothing the student types, scores, or does is ever the payload of a network request. The
deployed site is a set of static files; the host has no runtime and no logs of user actions
beyond ordinary static-asset access logs (which we should also disable or ignore).

## What stays, what goes, what changes

### Stays (no data involvement, keep as-is)
- Teleop practice (Three.js 3D driver view)
- Path planner
- Curriculum content, phase structure, UI, glow/hover animations, layout
- Playwright test harness and Vercel/static deployment

### Goes
- Firebase Auth, Firestore, security rules, Cloud Functions
- Gemini API (theory grading, answer screening, question generation, "AI coach")
- Team join / team name storage, leaderboards
- Mentor dashboard as a live view of other students' data
- Any analytics or error-reporting hooks

### Changes
| v1                                          | v2                                                                 |
|---------------------------------------------|--------------------------------------------------------------------|
| Login → user doc in Firestore               | No login. Progress in localStorage. Export/Import to `.json`.       |
| Gemini grades theory answers                | Rubric grader in JS: required-concept lists per question, fuzzy match (Levenshtein/`fuse.js`, vendored). Questions rewritten to be constrained so rubrics are reliable. |
| Gemini writes the report breakdown          | Deterministic report: rule-based text + charts from local stats and BKT mastery per module. |
| Gemini screens code submissions             | Pattern checks per lesson (required calls/structures present), plus a "show your mentor" export. No execution, no upload. |
| Mentor dashboard reads Firestore            | Mentor view = same static site, opens a student-exported `.json` via file picker. Read-only, nothing stored. |
| BKT (from Frontier) planned server-side     | BKT runs client-side on the correct/incorrect stream; it is what makes the report meaningful without an LLM. |

## Theory grading — how it works

1. Each theory question ships with a rubric: a list of required concepts, each with accepted
   phrasings (`["PID", "P.I.D.", "proportional-integral-derivative"]`), an optional list of
   disqualifying phrasings (common misconceptions), and a minimum coverage threshold.
2. The student's answer is normalized (lowercase, punctuation stripped) and each concept is
   matched with fuzzy string matching against the answer.
3. Score = concepts hit / concepts required. Feedback names the concepts that were missing,
   using pre-written hint text per concept.
4. The result (correct/incorrect + score) feeds BKT. The raw answer text is kept in localStorage
   only so the student can review it; it is never sent anywhere.

Questions that can't be constrained (true open-ended reflection) are kept but **ungraded**: they
are stored locally, appear in the export, and are labeled "for mentor review." They do not feed
BKT. This is deliberate — a similarity score dressed up as a grade is worse than no grade.

## Report — how it works

Inputs: driver practice stats (runs, best/avg times, error counts), curriculum progress (phases
complete, checkpoint pass rates), BKT mastery per module, streaks.

Output: a fixed-structure page with charts (progress over time, mastery by module, practice
consistency) and short rule-generated text: strongest module, weakest module, what to do next
(the lowest-mastery module that has its prerequisites met), and practice consistency callouts.
The text will be plainer than Gemini's. That's acceptable; the charts do the work.

## Mentor view — how it works

`mentor.html` on the same static site. A file picker accepts one or more student `.json`
exports, renders each student's report side by side, and can produce a team summary. Nothing is
uploaded, nothing is saved; refresh and it's gone. Students choose to share their file with a
mentor the way they'd share any document. This preserves oversight without the school ever
touching the data.

## Tradeoffs we accept (say these out loud in the approval meeting)

- Progress is per-device. Clear your browser data or switch laptops without exporting and it's
  gone. Mitigation: prominent export reminder, auto-download of a backup on phase completion.
- No live mentor visibility. Mentors see what students choose to send.
- Grading is less flexible than an LLM. Mitigation: constrained questions, pre-written hints.
- No team leaderboards or cross-student features.

## Open decisions (must be resolved with the school before Phase 1 — see PLAN.md Phase 0)

1. **Is localStorage on a school-owned device acceptable?** If yes, the plan above holds. If no,
   the app runs in-memory only (session-scoped) and export is the only persistence. Design the
   storage layer behind an interface so this is a one-file swap.
2. **Is a student-exported `.json` file acceptable?** It contains student data, but it's created
   and held by the student, not the school. Confirm they see it that way.
3. **Does the mentor view need to exist at all** for approval, or is it a nice-to-have that
   raises questions? Build it last so it can be cut without touching anything else.

## Success criteria

- School IT can open DevTools → Network, use every feature, and see zero requests containing
  student input. This is the demo for the approval meeting.
- All v1 non-data features work identically.
- Theory grading agrees with a human on ≥ 90% of a hand-labeled set of ~50 sample answers
  (write this set first; it's the regression suite for rubrics).
- A student can export on one machine, import on another, and see identical state.
- Old `r-tracker/` is untouched and still deployable if the school reverses course.
