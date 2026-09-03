// Shared helpers for Playwright specs. Everything goes through the page's RTStore.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Load js/schema.js in Node (it is a classic script that writes window.RTSchema).
export function loadSchema() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'schema.js'), 'utf8');
  const sandbox = { window: {}, console };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.RTSchema;
}

export function makeSampleState() {
  const S = loadSchema();
  const s = S.createEmptyState();
  const now = Date.now();
  s.profile.displayName = 'Test Driver';
  s.driver.levels['1'] = { bestStars: 3, rating: 'gold', bestTime: 6.5, bestAccuracy: 96, attempts: 4, completions: 3, firstCompletedAt: now - 86400000, lastPlayed: now };
  s.driver.levels['2'] = { bestStars: 1, rating: 'bronze', bestTime: 12.1, bestAccuracy: 80, attempts: 2, completions: 1, firstCompletedAt: now, lastPlayed: now };
  Object.assign(s.driver.stats, { overallRating: 71, grade: 'C', smoothness: 70, stability: 65, strafe: 80, turn: 60, levelScore: 88, recovery: 68, turnOvershootDeg: 12.5, atSpeedFraction: 0.55, ratedLevels: 2, totalPracticeMs: 1800000, levelsCompleted: 2, totalDistanceFt: 140, lastUpdated: now });
  s.driver.coachReports.push({ generatedAt: now, overallScore: 71, letterGrade: 'C', percentile: 'Around par', driverProfile: 'The Technician — steady and precise', overallSummary: 'Solid session.', detailedAnalysis: '', strengths: ['Strafe'], weaknesses: ['Turn'], trainingPlan: ['Practice turns'], scores: { smoothness: 70, stability: 65, strafe: 80, turn: 60, levelScore: 88, recovery: 68, turnOvershootDeg: 12.5, atSpeedFraction: 0.55 }, metricsSnapshot: {} });
  s.driver.sessions.push({ id: 's_1', startedAt: now - 600000, endedAt: now, durationMs: 600000, levelsAttempted: 3, levelsCompleted: 2, distanceFt: 140, ratingAtEnd: 71 });
  s.driver.runs.push(
    { levelId: 1, sessionId: 's_1', completed: true, timeMs: 1500, pathAccuracy: 96, collisions: 0, atSpeedFraction: 0.7, styleMetrics: { smoothness: 70, stability: 65, strafe: null, turn: 60, turnOvershootDeg: 12.5, recovery: 68, sufficient: true }, physics: { maxSpd: 6.5, turnRate: 270, accel: 20, braking: 20, inputDelay: 80 }, rated: true, timestamp: now - 500000 },
    { levelId: 2, sessionId: 's_1', completed: false, timeMs: 5000, pathAccuracy: 60, collisions: 1, atSpeedFraction: 0.4, styleMetrics: { smoothness: 60, stability: 60, strafe: 70, turn: null, turnOvershootDeg: null, recovery: null, sufficient: true }, physics: { maxSpd: 6.5, turnRate: 270, accel: 20, braking: 20, inputDelay: 80 }, rated: true, timestamp: now - 400000 },
    { levelId: 2, sessionId: 's_1', completed: true, timeMs: 2100, pathAccuracy: 80, collisions: 0, atSpeedFraction: 0.5, styleMetrics: { smoothness: 62, stability: 61, strafe: 72, turn: null, turnOvershootDeg: null, recovery: null, sufficient: true }, physics: { maxSpd: 6.5, turnRate: 270, accel: 20, braking: 20, inputDelay: 80 }, rated: true, timestamp: now - 300000 }
  );
  s.curriculum.phases.phase0 = Object.assign(S.createEmptyPhase('phase0'), { status: 'verified', score: 90, passed: true, attempts: 1, lastAttempt: now, verifiedAt: now, verifiedBy: 'auto' });
  s.curriculum.phases.phase1 = Object.assign(S.createEmptyPhase('phase1'), { status: 'in_progress', startedAt: now, lessonProgress: ['ftc-ecosystem'] });
  s.curriculum.attempts.push({ ts: now, phaseId: 'phase0', sectionId: 'q0', kind: 'mc', graded: true, correct: true, score: 100, attempt: 1 });
  s.paths.push({ id: 'p_1', name: 'Sample path', waypoints: [{ x: 24, y: 24 }, { x: 72, y: 72 }], segments: [], pathSettings: {}, createdAt: now, updatedAt: now });
  s.strategies.push({ id: 's_1', name: 'Blue A', annotations: [], notes: 'notes', createdAt: now, updatedAt: now });
  return s;
}

// A year of activity: ~120 practice sessions, graded attempts across phases 0–3, several verified phases.
export function makeYearState() {
  const S = loadSchema();
  const s = S.createEmptyState();
  const now = Date.now();
  const DAY = 86400000;
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

  for (let i = 0; i < 120; i++) {
    const daysAgo = Math.floor(rnd() * 365);
    const startedAt = now - daysAgo * DAY - Math.floor(rnd() * 8 * 3600000);
    const durationMs = 60000 * (5 + Math.floor(rnd() * 40));
    const attempted = 1 + Math.floor(rnd() * 6);
    s.driver.sessions.push({ id: 's_' + i, startedAt, endedAt: startedAt + durationMs, durationMs, levelsAttempted: attempted, levelsCompleted: Math.floor(attempted * rnd()), distanceFt: Math.floor(rnd() * 400), ratingAtEnd: 40 + Math.floor(rnd() * 50) });
  }
  s.driver.sessions.sort((a, b) => a.startedAt - b.startedAt);
  for (let d = 0; d < 4; d++) {   // a current 4-day streak
    const startedAt = now - d * DAY - 3600000;
    s.driver.sessions.push({ id: 's_streak' + d, startedAt, endedAt: startedAt + 600000, durationMs: 600000, levelsAttempted: 3, levelsCompleted: 2, distanceFt: 120, ratingAtEnd: 72 });
  }
  for (let lv = 1; lv <= 9; lv++) {
    const stars = lv <= 4 ? 3 : lv <= 7 ? 2 : 1;
    s.driver.levels[String(lv)] = { bestStars: stars, rating: stars === 3 ? 'gold' : stars === 2 ? 'silver' : 'bronze', bestTime: 5 + lv * 1.7, bestAccuracy: 70 + (12 - lv) * 2, attempts: 3 + lv, completions: 2, firstCompletedAt: now - (300 - lv * 20) * DAY, lastPlayed: now - lv * DAY };
  }
  Object.assign(s.driver.stats, { overallRating: 74, grade: 'C', smoothness: 78, stability: 66, strafe: 82, turn: 61, levelScore: 84, recovery: 70, turnOvershootDeg: 11.7, atSpeedFraction: 0.62, ratedLevels: 6, totalPracticeMs: 120 * 20 * 60000, levelsCompleted: 9, totalDistanceFt: 24000, lastUpdated: now - 3600000 });
  for (let r = 0; r < 10; r++) {
    const score = 55 + r * 2;
    s.driver.coachReports.push({ generatedAt: now - (10 - r) * 30 * DAY, overallScore: score, letterGrade: score >= 75 ? 'B' : score >= 65 ? 'C' : 'D', percentile: 'Around par', driverProfile: 'The Technician — steady and precise', overallSummary: 'Session ' + r, detailedAnalysis: 'Analysis ' + r, strengths: ['Strafe'], weaknesses: ['Turn precision'], trainingPlan: ['Practice Level 5 turns'], scores: { smoothness: 70 + r, stability: 60 + r, strafe: 80, turn: 55 + r, levelScore: 84, recovery: 68, turnOvershootDeg: 20 - r, atSpeedFraction: 0.5 }, metricsSnapshot: {} });
  }
  // Per-run level records over the last 6 sessions (levels 1–6, mixed results)
  const PAR = { 1: 1600, 2: 1300, 3: 3000, 4: 6300, 5: 4300, 6: 5300 };
  const PHYS = { maxSpd: 6.5, turnRate: 270, accel: 20, braking: 20, inputDelay: 80 };
  for (let sess = 0; sess < 6; sess++) {
    const base = now - (6 - sess) * DAY - 3600000;
    for (let lv = 1; lv <= 6; lv++) {
      const completed = rnd() > 0.2;
      const mult = 0.8 + rnd() * 0.8;
      s.driver.runs.push({ levelId: lv, sessionId: 's_streak' + sess, completed, timeMs: Math.round(PAR[lv] * (completed ? mult : 2.5)), pathAccuracy: 70 + Math.floor(rnd() * 30), collisions: rnd() > 0.7 ? 1 : 0, atSpeedFraction: Math.round(rnd() * 100) / 100, styleMetrics: { smoothness: 60 + Math.floor(rnd() * 30), stability: 60 + Math.floor(rnd() * 30), strafe: null, turn: 50 + Math.floor(rnd() * 40), turnOvershootDeg: Math.round(rnd() * 200) / 10, recovery: null, sufficient: true }, physics: PHYS, rated: true, timestamp: base + lv * 90000 });
    }
  }
  // Curriculum: phases 0–2 verified, 3 in progress with theory graded, MC attempts logged everywhere
  const verified = (id, extra) => Object.assign(S.createEmptyPhase(id), { status: 'verified', verifiedAt: now - 100 * DAY, verifiedBy: 'auto', passed: true, bestScore: 82 }, extra || {});
  s.curriculum.phases.phase0 = verified('phase0', { score: 90, attempts: 1, quizAnswers: {} });
  s.curriculum.phases.phase1 = verified('phase1');
  s.curriculum.phases.phase2 = verified('phase2');
  s.curriculum.phases.phase3 = Object.assign(S.createEmptyPhase('phase3'), { status: 'in_progress', startedAt: now - 20 * DAY });
  let ts = now - 200 * DAY;
  for (let q = 0; q < 10; q++) s.curriculum.attempts.push({ ts: ts += 60000, phaseId: 'phase0', sectionId: 'q' + q, kind: 'mc', graded: true, correct: q !== 3, score: q !== 3 ? 100 : 0, attempt: 1 });
  const p1 = ['ftc-ecosystem', 'hardware-map', 'opmode-types', 'motor-power', 'first-opmode', 'gamepad-y-axis', 'gamepad-buttons', 'telemetry-debugging'];
  const p2 = ['why-structure', 'subsystems-intro', 'hardware-isolation', 'encapsulation', 'enums', 'state-machines', 'robot-class', 'clean-teleop'];
  [['phase1', p1], ['phase2', p2]].forEach(([pid, ids]) => {
    ids.forEach((sid, i) => {
      if (i % 3 === 1) s.curriculum.attempts.push({ ts: ts += 60000, phaseId: pid, sectionId: sid, kind: 'mc', graded: true, correct: false, score: 0, attempt: 1 });
      s.curriculum.attempts.push({ ts: ts += 60000, phaseId: pid, sectionId: sid, kind: 'mc', graded: true, correct: true, score: 100, attempt: i % 3 === 1 ? 2 : 1 });
    });
    s.curriculum.attempts.push({ ts: ts += 60000, phaseId: pid, sectionId: 'deliverable', kind: 'code', graded: true, correct: true, score: 82, attempt: 1 });
  });
  ['theory-sensor-physics', 'theory-hsv-physics'].forEach((sid, i) => {
    s.curriculum.attempts.push({ ts: ts += 60000, phaseId: 'phase3', sectionId: sid, kind: 'theory', graded: true, correct: i === 0, score: i === 0 ? 85 : 40, attempt: 1 });
    s.curriculum.phases.phase3.theoryAnswers[sid] = { answer: 'An answer.', status: 'graded', score: i === 0 ? 85 : 40, passed: i === 0, bestScore: i === 0 ? 85 : 40, feedback: '', attempts: 1, lastAttempt: ts, history: [] };
  });
  s.curriculum.phases.phase3.lessonProgress = ['theory-sensor-physics'];
  s.paths.push({ id: 'p_1', name: 'Left auto', waypoints: [{ x: 24, y: 24 }], segments: [], pathSettings: {}, createdAt: now - 50 * DAY, updatedAt: now - 50 * DAY });
  s.strategies.push({ id: 's_1', name: 'Blue A', annotations: [], notes: '', createdAt: now - 40 * DAY, updatedAt: now - 40 * DAY });
  return s;
}

export async function seedState(page, state) {
  const r = await page.evaluate(s => window.RTStore.importJSON(JSON.stringify(s)), state);
  if (!r.ok) throw new Error('seedState failed: ' + r.error);
  return r;
}

export function readState(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.RTStore.get())));
}

// The sidebar starts collapsed (export/import controls hidden); open it and wait for the Export button.
export async function openSidebar(page) {
  await page.waitForSelector('#sidebar');
  await page.evaluate(() => { if (!document.body.classList.contains('sidebar-open')) window.toggleSidebar(); });
  await page.waitForSelector('#sb-export-btn', { state: 'visible' });
}

// Click the correct option for every Phase 0 quiz question (curriculum page must be showing phase0).
export async function answerQuizCorrectly(page) {
  const n = await page.evaluate(() => window.QUIZ.length);
  for (let i = 0; i < n; i++) {
    const correct = await page.evaluate(i => window.QUIZ[i].correct, i);
    await page.locator(`#quiz-opts-${i} .quiz-opt`).nth(correct).click();
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('#quiz-results.show', { timeout: 5000 });
}

// Mark every phase before `phaseId` verified so it becomes reachable, then re-render.
export async function unlockPhase(page, phaseId) {
  await page.evaluate(pid => {
    const ids = window.RTSchema.PHASE_IDS;
    const idx = ids.indexOf(pid);
    window.RTStore.update(s => {
      for (let i = 0; i < idx; i++) {
        const id = ids[i];
        s.curriculum.phases[id] = Object.assign(window.RTSchema.createEmptyPhase(id), { status: 'verified', verifiedAt: Date.now(), verifiedBy: 'auto', passed: true });
      }
    });
    window.loadCurriculumData();
  }, phaseId);
}
