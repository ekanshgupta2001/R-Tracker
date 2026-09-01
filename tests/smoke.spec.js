// Smoke tests: every page loads with no JS errors, no failed requests, and no
// request to another origin. Runs against tests/serve.js (see playwright.config.js).
import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'TeleOp', path: '/pages/teleop.html' },
  { name: 'Path Planner', path: '/pages/pathplanner.html' },
  { name: 'Strategy', path: '/pages/strategy.html' },
  { name: 'Curriculum', path: '/pages/curriculum.html' },
  { name: 'Report', path: '/pages/report.html' },
  { name: 'About', path: '/pages/about.html' },
];

for (const pg of PAGES) {
  test(`${pg.name} page loads without errors`, async ({ page, baseURL }) => {
    const problems = [];
    page.on('pageerror', err => problems.push('pageerror: ' + err.message));
    page.on('console', msg => { if (msg.type() === 'error') problems.push('console: ' + msg.text()); });
    page.on('response', res => { if (res.status() >= 400) problems.push('HTTP ' + res.status() + ' ' + res.url()); });
    page.on('request', req => { if (!req.url().startsWith(baseURL)) problems.push('cross-origin: ' + req.url()); });

    await page.goto(pg.path, { waitUntil: 'load' });
    await page.waitForFunction(() => window.RTStore && window.RTStore.ready);
    await page.waitForTimeout(300);

    const body = await page.locator('body').textContent();
    expect(body.length).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
}

test('Sidebar navigation links exist and point at surviving pages', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  const hrefs = await page.locator('#sidebar a.nav-item').evaluateAll(as => as.map(a => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(3);
  for (const h of hrefs) {
    expect(h).not.toMatch(/dashboard|manage-team/);
  }
});

test('Theme preference is respected on load (the only localStorage key)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('#sidebar');
  await page.evaluate(() => localStorage.setItem('rt-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  expect(await page.locator('html.light').count()).toBe(1);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(['rt-theme']);
});

test('Curriculum page shows the phase timeline', async ({ page }) => {
  await page.goto('/pages/curriculum.html', { waitUntil: 'load' });
  await page.waitForSelector('.tl-node');
  const text = await page.locator('body').textContent();
  expect(text).toContain('Phase 0');
  expect(text).toContain('Phase 1');
  expect(text).toContain('Make It Move');
});
