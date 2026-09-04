// The proof for the school: a full scripted student session during which every
// request the browser makes is a same-origin GET for a static file, with no query
// string and no body. Also checks the CSP header is sent and every page's <meta> CSP
// is identical to the one on index.html.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerQuizCorrectly, unlockPhase, readState, openSidebar } from './helpers/state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_EXT = ['.html', '.js', '.css', '.svg', '.webp', '.png', '.woff2', '.json', '.ico'];

// The policy on index.html is the reference copy; every other page must carry the same string.
function pageCsp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!m) throw new Error('CSP meta not found in index.html');
  return m[1];
}

test('full student session makes only same-origin static GETs', async ({ page, context, baseURL }) => {
  test.setTimeout(90000);
  const ORIGIN = new URL(baseURL).origin;
  const requests = [];
  const violations = [];
  const badStatuses = [];
  const errors = [];
  let homeCspHeader = null;

  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(ORIGIN)) { violations.push(url); return route.abort(); }
    return route.continue();
  });
  // blob: URLs are in-memory objects created by Export; they never leave the browser.
  page.on('request', r => { if (!r.url().startsWith('blob:')) requests.push({ url: r.url(), method: r.method(), postData: r.postData(), type: r.resourceType() }); });
  page.on('response', r => {
    if (r.status() >= 400) badStatuses.push(r.status() + ' ' + r.url());
    if (r.url() === ORIGIN + '/' && !homeCspHeader) homeCspHeader = r.headers()['content-security-policy'] || null;
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  const expectedMeta = pageCsp();
  const visited = [];
  async function visit(p) {
    await page.goto(p, { waitUntil: 'load' });
    await page.waitForFunction(() => window.RTStore && window.RTStore.ready);
    visited.push(p);
    const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(meta, 'CSP meta on ' + p).toBe(expectedMeta);
  }

  // Home
  await visit('/');
  await page.waitForSelector('#sidebar');
  await expect(page.locator('#rbar-main-score')).toHaveCount(1);

  // TeleOp: start a level, drive with the keyboard, finish it, open the report
  await visit('/pages/teleop.html');
  await page.click('#tab-levels');
  await page.locator('#lvl-list .lvl-card').first().click();
  await page.waitForFunction(() => typeof lvl !== 'undefined' && lvl.phase === 'attempt', null, { timeout: 10000 });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  await page.evaluate(() => { if (lvl.phase === 'attempt') finishLevel(false); });
  await page.evaluate(() => openDriverReport());
  await expect(page.locator('#an-grade')).not.toHaveText('');
  await page.waitForFunction(() => window.RTStore.get().driver.stats.lastUpdated !== null);
  let s = await readState(page);
  expect(Object.keys(s.driver.levels).length).toBeGreaterThan(0);

  // Path planner: add waypoints and save a path
  await visit('/pages/pathplanner.html');
  await page.evaluate(() => { addWaypointAtCenter(); addWaypointAtCenter(); });
  await page.evaluate(() => openPathModal('save'));
  await page.fill('#ppc-name-input', 'audit path');
  await page.click('.ppc-save-btn');
  s = await readState(page);
  expect(s.paths.length).toBe(1);

  // Strategy: save one
  await visit('/pages/strategy.html');
  await page.evaluate(() => { document.getElementById('sm-name-input').value = 'audit strategy'; saveStrategy(); });
  s = await readState(page);
  expect(s.strategies.length).toBe(1);

  // Curriculum: pass the quiz, then submit a theory answer in Phase 3 (graded locally by the rubric)
  await visit('/pages/curriculum.html');
  await page.waitForSelector('.tl-node');
  await answerQuizCorrectly(page);
  await expect(page.locator('#quiz-results')).toContainText('Congratulations');
  await unlockPhase(page, 'phase3');
  await page.click('.tl-node[data-phase="phase3"]');
  await page.click('.curr-action-btn.btn-start');
  await page.fill('#les-written-theory-sensor-physics', 'The gym lighting differs from the workshop and the sensor is at a different distance and angle, so the raw value changes with the environment. A single fixed threshold cannot work in both rooms.');
  await page.click('#les-wsubmit-theory-sensor-physics');
  const fb = page.locator('#les-wfeedback-theory-sensor-physics');
  await expect(fb).toContainText(/Understanding Confirmed|Keep Thinking/);
  await expect(fb).toContainText(/\d+\/100/);
  s = await readState(page);
  const ta = s.curriculum.phases.phase3.theoryAnswers['theory-sensor-physics'];
  expect(ta.status).toBe('graded');
  expect(typeof ta.score).toBe('number');
  expect(s.curriculum.attempts.some(a => a.kind === 'theory' && a.graded === true && typeof a.correct === 'boolean')).toBe(true);

  // Report + About
  await visit('/pages/report.html');
  await expect(page.locator('#overview-content .skeleton')).toHaveCount(0);
  await visit('/pages/about.html');

  // Export: a download, not a request
  await openSidebar(page);
  const countBefore = requests.length;
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sb-export-btn')]);
  expect(dl.suggestedFilename()).toMatch(/^rtracker-progress-/);
  expect(requests.length).toBe(countBefore);

  // ── Assertions on the network ──
  expect(violations, 'cross-origin requests').toEqual([]);
  expect(requests.length).toBeGreaterThan(20);
  for (const r of requests) {
    const u = new URL(r.url);
    expect(u.origin, r.url).toBe(ORIGIN);
    expect(r.method, r.url).toBe('GET');
    expect(u.search, r.url).toBe('');
    expect(r.postData, r.url).toBeNull();
    const ok = u.pathname === '/' || ALLOWED_EXT.some(ext => u.pathname.endsWith(ext));
    expect(ok, 'unexpected resource: ' + u.pathname).toBe(true);
  }
  expect(badStatuses).toEqual([]);
  expect(errors).toEqual([]);
  expect(homeCspHeader, 'CSP header on /').toContain("default-src 'self'");
  expect(homeCspHeader).toContain("connect-src 'none'");

  // Storage: no localStorage beyond the theme key; sessionStorage only rt-* keys
  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  expect(storage.local.filter(k => k !== 'rt-theme')).toEqual([]);
  expect(storage.session.filter(k => !k.startsWith('rt-'))).toEqual([]);

  console.log(`network-audit: ${requests.length} requests across ${visited.length} pages, all same-origin GET`);
});
