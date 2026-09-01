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
  Object.assign(s.driver.stats, { overallRating: 71, grade: 'B', smoothness: 70, stability: 65, strafe: 80, turn: 60, levelScore: 75, recovery: 68, totalPracticeMs: 1800000, levelsCompleted: 2, totalDistanceFt: 140, lastUpdated: now });
  s.driver.coachReports.push({ generatedAt: now, overallScore: 71, letterGrade: 'B', percentile: 'Top 25% of drivers', driverProfile: 'The Technician — steady and precise', overallSummary: 'Solid session.', detailedAnalysis: '', strengths: ['Strafe'], weaknesses: ['Turn'], trainingPlan: ['Practice turns'], scores: { smoothness: 70, stability: 65, strafe: 80, turn: 60, levelScore: 75, recovery: 68 }, metricsSnapshot: {} });
  s.driver.sessions.push({ id: 's_1', startedAt: now - 600000, endedAt: now, durationMs: 600000, levelsAttempted: 3, levelsCompleted: 2, distanceFt: 140, ratingAtEnd: 71 });
  s.curriculum.phases.phase0 = Object.assign(S.createEmptyPhase('phase0'), { status: 'verified', score: 90, passed: true, attempts: 1, lastAttempt: now, verifiedAt: now, verifiedBy: 'auto' });
  s.curriculum.phases.phase1 = Object.assign(S.createEmptyPhase('phase1'), { status: 'in_progress', startedAt: now, lessonProgress: ['ftc-ecosystem'] });
  s.curriculum.attempts.push({ ts: now, phaseId: 'phase0', sectionId: 'q0', kind: 'mc', graded: true, correct: true, score: 100, attempt: 1 });
  s.paths.push({ id: 'p_1', name: 'Sample path', waypoints: [{ x: 24, y: 24 }, { x: 72, y: 72 }], segments: [], pathSettings: {}, createdAt: now, updatedAt: now });
  s.strategies.push({ id: 's_1', name: 'Blue A', annotations: [], notes: 'notes', createdAt: now, updatedAt: now });
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
