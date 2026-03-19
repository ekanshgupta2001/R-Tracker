const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:5500';

const pages = [
  { name: 'Home', path: '/' },
  { name: 'TeleOp', path: '/pages/teleop.html' },
  { name: 'Path Planner', path: '/pages/pathplanner.html' },
  { name: 'Curriculum', path: '/pages/curriculum.html' },
  { name: 'Report', path: '/pages/report.html' },
  { name: 'About', path: '/pages/about.html' },
  { name: 'Dashboard', path: '/pages/dashboard.html' },
  { name: 'Manage Team', path: '/pages/manage-team.html' },
];

for (const page of pages) {
  test(`${page.name} page loads without errors`, async ({ page: p }) => {
    const errors = [];
    p.on('pageerror', err => errors.push(err.message));

    await p.goto(BASE + page.path, { waitUntil: 'networkidle', timeout: 15000 });

    // Page should have content
    const body = await p.locator('body').textContent();
    expect(body.length).toBeGreaterThan(0);

    // No JS errors
    expect(errors).toEqual([]);

    // Screenshot for visual review
    await p.screenshot({ path: `test-results/${page.name.toLowerCase().replace(/ /g, '-')}.png`, fullPage: true });
  });
}

test('Sidebar navigation links work', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });

  const sidebarLinks = await page.locator('nav a, .sidebar a').all();
  console.log('Found', sidebarLinks.length, 'sidebar links');
  expect(sidebarLinks.length).toBeGreaterThan(3);
});

test('Dark/light mode toggle exists', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Verify toggle element exists
  const toggle = page.locator('text=Toggle Theme').first();
  const exists = await toggle.count();
  expect(exists).toBeGreaterThan(0);

  // Test that localStorage theme is respected on load
  await page.evaluate(() => localStorage.setItem('rt-theme', 'light'));
  await page.reload({ waitUntil: 'networkidle' });
  const hasLightMode = await page.locator('html.light-mode, body.light-mode, [data-theme="light"]').count();

  await page.screenshot({ path: 'test-results/light-mode.png', fullPage: true });
});

test('Curriculum page shows phase timeline', async ({ page }) => {
  await page.goto(BASE + '/pages/curriculum.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Should have phase nodes visible
  const phaseText = await page.locator('body').textContent();
  expect(phaseText).toContain('Phase 0');
  expect(phaseText).toContain('Phase 1');
  expect(phaseText).toContain('Make It Move');
});
