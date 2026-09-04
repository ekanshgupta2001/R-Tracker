// Phase 2 gate: progress survives a reload in the tab, export → clear → import restores
// identical state, the memory backend keeps nothing, and imported strings are untrusted.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { loadSchema, makeSampleState, seedState, readState, answerQuizCorrectly, openSidebar } from './helpers/state.js';

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
});

test('progress survives reload and navigation within the tab (sessionStorage backend)', async ({ page }) => {
  await page.goto('/pages/curriculum.html', { waitUntil: 'load' });
  await page.waitForSelector('.tl-node');
  expect(await page.evaluate(() => RTStore.backendName())).toBe('session');

  await answerQuizCorrectly(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tl-node');
  let s = await readState(page);
  expect(s.curriculum.phases.phase0.status).toBe('verified');
  expect(await page.locator('.tl-node[data-phase="phase1"]').getAttribute('data-status')).not.toBe('locked');

  // Another page in the same tab sees the same state; a saved path survives a reload
  await page.goto('/pages/pathplanner.html', { waitUntil: 'load' });
  s = await readState(page);
  expect(s.curriculum.phases.phase0.status).toBe('verified');
  await page.evaluate(() => { addWaypointAtCenter(); addWaypointAtCenter(); openPathModal('save'); });
  await page.fill('#ppc-name-input', 'keep me');
  await page.click('.ppc-save-btn');
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => openPathModal('load'));
  await expect(page.locator('.ppc-path-name')).toContainText('keep me');

  // A path name is user text: one that looks like markup is shown as text, not rendered as an element.
  await page.evaluate(() => { addWaypointAtCenter(); addWaypointAtCenter(); openPathModal('save'); });
  await page.fill('#ppc-name-input', '<b>bold</b> path');
  await page.click('.ppc-save-btn');
  await page.evaluate(() => openPathModal('load'));
  await expect(page.locator('#ppc-path-list .ppc-path-name').first()).toHaveText('<b>bold</b> path');
  expect(await page.locator('#ppc-path-list b').count()).toBe(0);

  const keys = await page.evaluate(() => Object.keys(sessionStorage));
  expect(keys).toContain('rt-state');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('export → clear → import restores identical state; banner tracks unsaved changes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await seedState(page, makeSampleState());
  await page.reload({ waitUntil: 'load' });
  await openSidebar(page);

  // A change makes the banner appear
  await page.evaluate(() => RTStore.update(s => { s.profile.displayName = 'Changed'; }));
  await expect(page.locator('#rt-dirty-banner')).toBeVisible();
  await expect(page.locator('#sb-progress-status')).toHaveText(/Unsaved/);

  const before = await readState(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sb-export-btn')]);
  expect(dl.suggestedFilename()).toMatch(/^rtracker-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  const exported = JSON.parse(text);
  expect(exported.meta.app).toBe('r-tracker');
  expect(exported.schemaVersion).toBe(2);
  await expect(page.locator('#rt-dirty-banner')).toBeHidden();
  await expect(page.locator('#sb-progress-status')).toHaveText(/Exported/);

  await page.evaluate(() => RTStore.clear());
  expect((await readState(page)).paths.length).toBe(0);

  await page.setInputFiles('#sb-import-file', { name: dl.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(() => window.RTStore && RTStore.ready && RTStore.get().paths.length === 1, null, { timeout: 10000 });
  await page.waitForSelector('#sidebar');
  const after = await readState(page);

  const strip = s => { const c = JSON.parse(JSON.stringify(s)); delete c.meta; return c; };
  expect(strip(after)).toEqual(strip(before));
  expect(after.meta.dirtySinceExport).toBe(false);
});

// The banner's ✕ is stored in state, so it holds on every page of the tab and comes back
// only after an export starts a new cycle. Dismissing it is not itself an unsaved change.
test('dismissing the unsaved banner holds across pages until the next export', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await seedState(page, makeSampleState());
  await page.reload({ waitUntil: 'load' });
  await openSidebar(page);

  await page.evaluate(() => RTStore.update(s => { s.profile.displayName = 'Changed'; }));
  await expect(page.locator('#rt-dirty-banner')).toBeVisible();
  await page.click('#rt-dirty-banner .rt-dirty-close');
  await expect(page.locator('#rt-dirty-banner')).toBeHidden();
  let s = await readState(page);
  expect(s.meta.exportReminderDismissed).toBe(true);
  expect(s.meta.dirtySinceExport).toBe(true);
  await expect(page.locator('#sb-progress-status')).toHaveText(/Unsaved/);

  for (const path of ['/pages/report.html', '/pages/curriculum.html', '/pages/teleop.html']) {
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForFunction(() => !!document.getElementById('rt-dirty-banner'));
    await page.evaluate(() => RTStore.update(s => { s.profile.displayName = 'Changed again'; }));
    await expect(page.locator('#rt-dirty-banner'), path).toBeHidden();
  }

  // Export starts a new cycle: the next change shows the banner once more.
  await page.goto('/', { waitUntil: 'load' });
  await openSidebar(page);
  await Promise.all([page.waitForEvent('download'), page.click('#sb-export-btn')]);
  s = await readState(page);
  expect(s.meta.exportReminderDismissed).toBe(false);
  await expect(page.locator('#rt-dirty-banner')).toBeHidden();
  await page.evaluate(() => RTStore.update(s => { s.profile.displayName = 'After export'; }));
  await expect(page.locator('#rt-dirty-banner')).toBeVisible();

  // An imported file never carries a dismissal into the new tab.
  const dismissed = makeSampleState();
  dismissed.meta.exportReminderDismissed = true;
  await seedState(page, dismissed);
  expect((await readState(page)).meta.exportReminderDismissed).toBe(false);
});

test('the milestone toast fires once per page, not on every milestone', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await seedState(page, makeSampleState());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('rt-toast'));

  await page.evaluate(() => RTStore.update(s => { s.profile.displayName = 'Changed'; }));
  await page.evaluate(() => rtDismissBanner());          // the toast is skipped while the banner is up
  await page.evaluate(() => rtNudgeExport('first'));
  await expect(page.locator('#rt-toast')).toBeVisible();
  await expect(page.locator('#rt-toast')).toContainText('first');

  await page.evaluate(() => { document.getElementById('rt-toast').hidden = true; });
  await page.evaluate(() => rtNudgeExport('second'));
  await expect(page.locator('#rt-toast')).toBeHidden();
  await expect(page.locator('#rt-toast')).not.toContainText('second');
});

test('the welcome panel hides once the tab holds progress or an opened file', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await expect(page.locator('#rt-first-run')).toBeVisible();      // fresh tab

  await seedState(page, makeSampleState());                        // progress
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await expect(page.locator('#rt-first-run')).toBeHidden();

  const S = loadSchema();
  const emptyExport = S.createEmptyState();                        // an opened file with nothing in it yet
  emptyExport.meta.lastExportedAt = Date.now();
  await seedState(page, emptyExport);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await expect(page.locator('#rt-first-run')).toBeHidden();

  await page.evaluate(() => RTStore.clear());                      // back to a fresh tab
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await expect(page.locator('#rt-first-run')).toBeVisible();
  await page.fill('#rt-first-run-name', 'Sam');
  await page.click('#rt-first-run .first-run-btn.primary');
  await expect(page.locator('#rt-first-run')).toBeHidden();
  const s = await readState(page);
  expect(s.meta.firstRunDismissed).toBe(true);
  expect(s.profile.displayName).toBe('Sam');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await expect(page.locator('#rt-first-run')).toBeHidden();
});

test('MemoryBackend keeps nothing across a reload (the one-constant fallback)', async ({ page, context }) => {
  await context.addInitScript(() => { window.__RT_BACKEND = 'memory'; });
  await page.goto('/pages/pathplanner.html', { waitUntil: 'load' });
  expect(await page.evaluate(() => RTStore.backendName())).toBe('memory');
  await page.evaluate(() => { addWaypointAtCenter(); openPathModal('save'); });
  await page.fill('#ppc-name-input', 'gone soon');
  await page.click('.ppc-save-btn');
  expect((await readState(page)).paths.length).toBe(1);
  await page.reload({ waitUntil: 'load' });
  expect((await readState(page)).paths.length).toBe(0);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k === 'rt-state'))).toEqual([]);
});

test('imported strings render escaped and unsupported files are rejected', async ({ page }) => {
  await page.goto('/pages/pathplanner.html', { waitUntil: 'load' });
  const s = makeSampleState();
  s.paths[0].name = '<img src=x onerror="window.__xss=1">';
  await seedState(page, s);
  await page.evaluate(() => openPathModal('load'));
  await expect(page.locator('.ppc-path-name')).toContainText('<img');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();

  const newer = await page.evaluate(() => RTStore.importJSON(JSON.stringify({ schemaVersion: 99, meta: { app: 'r-tracker' } })));
  expect(newer.ok).toBe(false);
  expect(newer.error).toMatch(/newer/);
  const foreign = await page.evaluate(() => RTStore.importJSON(JSON.stringify({ hello: 'world' })));
  expect(foreign.ok).toBe(false);
  const bad = await page.evaluate(() => RTStore.importJSON('not json'));
  expect(bad.ok).toBe(false);
});

// Schema 1 → 2: a v1 export (no per-run records, style numbers sampled at any speed)
// imports cleanly, keeps every level aggregate, session and coach report, gains an
// empty driver.runs, and drops the old style numbers to "no reading" (null).
test('a schema-1 progress file migrates to schema 2 without losing anything', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  const v1 = makeSampleState();
  v1.schemaVersion = 1;
  delete v1.driver.runs;
  v1.driver.stats = { overallRating: 71, grade: 'B', smoothness: 70, stability: 65, strafe: 80, turn: 60, levelScore: 75, recovery: 68, totalPracticeMs: 1800000, levelsCompleted: 2, totalDistanceFt: 140, lastUpdated: Date.now() };
  const r = await page.evaluate(s => RTStore.importJSON(JSON.stringify(s)), v1);
  expect(r.ok, r.error).toBe(true);
  const s = await readState(page);
  expect(s.schemaVersion).toBe(2);
  expect(s.driver.runs).toEqual([]);
  expect(s.driver.levels['1'].bestStars).toBe(3);
  expect(s.driver.levels['2'].attempts).toBe(2);
  expect(s.driver.sessions.length).toBe(1);
  expect(s.driver.coachReports.length).toBe(1);
  expect(s.driver.stats.totalPracticeMs).toBe(1800000);
  expect(s.driver.stats.smoothness).toBeNull();
  expect(s.driver.stats.ratedLevels).toBe(0);
  expect(s.driver.stats.overallRating).toBe(0);
  expect(s.paths.length).toBe(1);
  expect(s.curriculum.phases.phase0.status).toBe('verified');

  // The v2 file round-trips as-is (runs validated, kept).
  const v2 = makeSampleState();
  const r2 = await page.evaluate(s => RTStore.importJSON(JSON.stringify(s)), v2);
  expect(r2.ok, r2.error).toBe(true);
  expect((await readState(page)).driver.runs.length).toBe(3);
  const badRun = makeSampleState();
  badRun.driver.runs[0].levelId = 99;
  const r3 = await page.evaluate(s => RTStore.importJSON(JSON.stringify(s)), badRun);
  expect(r3.ok).toBe(false);
  expect(r3.error).toMatch(/runs/);
});
