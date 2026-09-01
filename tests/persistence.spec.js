// Phase 2 gate: progress survives a reload in the tab, export → clear → import restores
// identical state, the memory backend keeps nothing, and imported strings are untrusted.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { makeSampleState, seedState, readState, answerQuizCorrectly, openSidebar } from './helpers/state.js';

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
  expect(exported.schemaVersion).toBe(1);
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
