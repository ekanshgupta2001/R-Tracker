// Driver rating end to end: a scripted level run leaves a run record in RTStore,
// the result card and the Report Card show the run score and the new Level
// Performance section, and the rating on screen equals the formula in
// js/driver-rating.js applied to the stored runs (computed here in Node).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readState } from './helpers/state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadClassic(files) {
  const sandbox = { window: {}, console };
  sandbox.window.window = sandbox.window;
  for (const f of files) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  return sandbox.window;
}
const win = loadClassic(['js/level-table.js', 'js/driver-rating.js']);
const TABLE = win.RT_LEVEL_TABLE, R = win.RTDriverRating;

async function openTeleop(page, errors) {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('/pages/teleop.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RTStore && RTStore.ready && typeof startCountdown === 'function' && window.RTDriverRating && window.RT_LEVEL_TABLE);
}

// Start level `id` and hold a key until the attempt ends. Returns the final phase.
async function driveLevel(page, key) {
  await page.click('#tab-levels');
  await page.locator('#lvl-list .lvl-card').first().click();
  await page.waitForFunction(() => lvl.phase === 'attempt', null, { timeout: 10000 });
  await page.keyboard.down(key);
  await page.waitForFunction(() => lvl.phase === 'result' || lvl.phase === 'fail', null, { timeout: 8000 });
  await page.keyboard.up(key);
  return page.evaluate(() => lvl.phase);
}

test('a completed level run is stored, shown on the result card, and rated by the formula', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  await openTeleop(page, errors);

  // Level 1 "Straight Shot" runs from (0,-4) to (0,4); W drives +y in field-centric mode.
  expect(await driveLevel(page, 'KeyW')).toBe('result');

  const s = await readState(page);
  expect(s.driver.runs.length).toBe(1);
  const run = s.driver.runs[0];
  expect(run.levelId).toBe(1);
  expect(run.completed).toBe(true);
  expect(run.timeMs).toBeGreaterThan(0);
  expect(run.timeMs).toBeLessThan(TABLE.get(1).timeLimit * 1000);
  expect(run.pathAccuracy).toBeGreaterThanOrEqual(90);
  expect(run.collisions).toBe(0);
  expect(run.rated).toBe(true);
  expect(run.sessionId).toMatch(/^s_/);
  expect(typeof run.timestamp).toBe('number');
  expect(run.styleMetrics).toBeTruthy();
  // the slider defaults, which are what the par table assumes
  expect(run.physics).toEqual({ ...TABLE.DEFAULT_PHYSICS });
  // the v1 aggregate is still kept alongside
  expect(s.driver.levels['1'].completions).toBe(1);

  // The formula, evaluated in Node on the stored runs
  const expectedRun = Math.round(R.runScore(run, TABLE.get(1).parTimeMs));
  const expected = R.rate(s.driver.runs, TABLE);
  expect(expected.ratedLevels).toBe(1);
  expect(expected.rating).toBe(Math.round(R.runScore(run, TABLE.get(1).parTimeMs)));

  // Result card: time vs par and the run score
  const par1 = (TABLE.get(1).parTimeMs / 1000).toFixed(1) + 's';
  await expect(page.locator('#rc-stats')).toContainText('par ' + par1);
  await expect(page.locator('#rc-stats')).toContainText('Run score');
  await expect(page.locator('#rc-stats b').nth(2)).toHaveText(String(expectedRun));
  await expect(page.locator('#rc-delta')).toContainText(expected.grade + ' (' + expected.rating + ')');

  // Report Card
  await page.evaluate(() => openDriverReport());
  await expect(page.locator('#an-overall')).toHaveText('Overall: ' + expected.rating + ' / 100');
  await expect(page.locator('#an-grade')).toHaveText(expected.grade);
  await expect(page.locator('#an-percentile')).toContainText('1 level rated over 1 session');
  await expect(page.locator('#an-levels .an-lvl-row')).toHaveCount(1);
  await expect(page.locator('#an-levels')).toContainText('1 · Straight Shot');
  await expect(page.locator('#an-levels .an-lvl-score')).toHaveText(String(expectedRun));
  await expect(page.locator('#an-levels .an-lvl-time')).toContainText('/ ' + par1);
  await expect(page.locator('#an-levels .an-lvl-runs')).toHaveText('1');
  await expect(page.locator('#an-style-note')).not.toHaveText('');
  await expect(page.locator('#an-recommend')).toContainText(/par/);

  // Persisted stats follow the same numbers
  const s2 = await readState(page);
  expect(s2.driver.stats.overallRating).toBe(expected.rating);
  expect(s2.driver.stats.grade).toBe(expected.grade);
  expect(s2.driver.stats.ratedLevels).toBe(1);
  expect(s2.driver.stats.levelScore).toBe(run.pathAccuracy);

  // The page and Node agree on the formula, and style metrics play no part in it
  const pageRating = await page.evaluate(() => RTDriverRating.rate(RTStore.get().driver.runs, RT_LEVEL_TABLE).rating);
  expect(pageRating).toBe(expected.rating);
  const tampered = JSON.parse(JSON.stringify(s2.driver.runs));
  tampered[0].styleMetrics = { smoothness: 0, stability: 0, strafe: 0, turn: 0, recovery: 0, sufficient: true };
  tampered[0].atSpeedFraction = 0;
  expect(R.rate(tampered, TABLE).rating).toBe(expected.rating);

  // Coach tab renders from the same data without errors
  await page.evaluate(() => switchReportTab('coach'));
  await expect(page.locator('#coach-analysis-text')).toContainText('Rated on 1 level');
  expect(errors).toEqual([]);
});

test('a failed run stores a zero-scoring record and does not rate the level', async ({ page }) => {
  const errors = [];
  await openTeleop(page, errors);
  await page.click('#tab-levels');
  await page.locator('#lvl-list .lvl-card').first().click();
  await page.waitForFunction(() => lvl.phase === 'attempt', null, { timeout: 10000 });
  await page.evaluate(() => finishLevel(false));
  const s = await readState(page);
  expect(s.driver.runs.length).toBe(1);
  expect(s.driver.runs[0].completed).toBe(false);
  expect(R.runScore(s.driver.runs[0], TABLE.get(1).parTimeMs)).toBe(0);
  await page.evaluate(() => openDriverReport());
  await expect(page.locator('#an-overall')).toHaveText('Overall: 0 / 100');
  await expect(page.locator('#an-grade')).toHaveText('F');
  await expect(page.locator('#an-percentile')).toHaveText('Complete a level to get rated');
  await expect(page.locator('#an-levels .an-lvl-row')).toHaveCount(1);
  await expect(page.locator('#an-levels .an-lvl-score')).toHaveText('—');
  expect(errors).toEqual([]);
});

test('a run at custom physics is stored but not rated', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  await openTeleop(page, errors);
  await page.evaluate(() => { document.getElementById('s-ms').value = '10'; cfgUpdate(); });
  expect(await driveLevel(page, 'KeyW')).toBe('result');
  const s = await readState(page);
  expect(s.driver.runs.length).toBe(1);
  expect(s.driver.runs[0].completed).toBe(true);
  expect(s.driver.runs[0].rated).toBe(false);
  expect(s.driver.runs[0].physics.maxSpd).toBe(10);
  await expect(page.locator('#rc-stats')).toContainText('not rated');
  const rr = R.rate(s.driver.runs, TABLE);
  expect(rr.ratedLevels).toBe(0);
  expect(rr.unratedRuns).toBe(1);
  await page.evaluate(() => openDriverReport());
  await expect(page.locator('#an-overall')).toHaveText('Overall: 0 / 100');
  await expect(page.locator('#an-levels')).toContainText('other physics settings');
  expect(errors).toEqual([]);
});

test('driving into a wall at speed counts one collision; style metrics gate on time at speed', async ({ page }) => {
  const errors = [];
  await openTeleop(page, errors);
  // Free drive: hold W for 2.5 s. The robot reaches the top wall at 8 ft/s in under a second.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);
  const sc = await page.evaluate(() => computeScores());
  expect(sc.collisions).toBe(1);
  expect(sc.movingMs).toBeGreaterThan(500);
  expect(sc.atSpeedFraction).toBeGreaterThan(0.2);
  expect(sc.sufficient).toBe(true);
  expect(typeof sc.smoothness).toBe('number');
  // A fresh session with no driving is "insufficient data", and the Report Card says so
  await page.evaluate(() => resetMetrics());
  const fresh = await page.evaluate(() => computeScores());
  expect(fresh.sufficient).toBe(false);
  expect(fresh.smoothness).toBeNull();
  await page.evaluate(() => openDriverReport());
  await expect(page.locator('#an-style-note')).toContainText('Insufficient data');
  await expect(page.locator('#anp-smoothness')).toHaveText('—');
  expect(errors).toEqual([]);
});
