// Phase 3 gate: the report renders every section from local data (a seeded year of it),
// never prints undefined/NaN, renders in under a second, and shows a sensible empty view.
import { test, expect } from '@playwright/test';
import { makeYearState, seedState, readState } from './helpers/state.js';

const SECTION_IDS = ['overview-content', 'skills-content', 'consistency-content', 'curriculum-content', 'ai-content', 'alltime-content', 'levels-content', 'history-content'];

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
});

test('seeded year of data: every section renders, no undefined/NaN, under 1s', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/pages/report.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RTReport);
  await seedState(page, makeYearState());
  await page.evaluate(() => window.RTReport.render());

  for (const id of SECTION_IDS) {
    const text = (await page.locator('#' + id).textContent()).trim();
    expect(text.length, id + ' is empty').toBeGreaterThan(0);
    expect(text, id + ' shows undefined').not.toMatch(/undefined/);
    expect(text, id + ' shows NaN').not.toMatch(/NaN/);
    expect(text, id + ' shows null').not.toMatch(/\bnull\b/);
    expect(await page.locator('#' + id + ' .skeleton').count(), id + ' still has skeletons').toBe(0);
  }
  await expect(page.locator('#rpt-empty-banner')).toBeHidden();

  // Charts drew into their canvases
  expect(await page.locator('#skills-radar').evaluate(c => c.width > 0 && c.height > 0)).toBe(true);
  expect(await page.locator('#consistency-chart').evaluate(c => c.width > 0 && c.height > 0)).toBe(true);

  // Text sections reflect the seeded data
  await expect(page.locator('#overview-content')).toContainText('74');
  await expect(page.locator('#overview-content .rpt-next')).toContainText(/Phase 3/);
  await expect(page.locator('#consistency-content')).toContainText(/streak/i);
  await expect(page.locator('#curriculum-content')).toContainText(/3 phases completed/);
  await expect(page.locator('#curriculum-content')).toContainText(/Mastery by module/);
  await expect(page.locator('#levels-content')).toContainText('9/12');
  await expect(page.locator('#history-content .sh-item')).toHaveCount(15);

  // BKT wrote mastery into state; phase 1 (all correct on retry) is well above the prior
  const s = await readState(page);
  expect(s.bkt.paramsVersion).toBe('bkt-1');
  expect(s.bkt.mastery.phase1.phase).toBeGreaterThan(0.6);
  expect(s.bkt.mastery.phase3.observed).toBe(2);
  expect(s.bkt.mastery.phase5.observed).toBe(0);

  const ms = await page.evaluate(() => window.RTReport.lastRenderMs);
  expect(ms).toBeLessThan(1000);
  expect(errors).toEqual([]);
});

test('empty state renders a sensible "nothing yet" view', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/pages/report.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RTReport && document.querySelector('#overview-content .rpt-empty'));
  await expect(page.locator('#rpt-empty-banner')).toBeVisible();
  for (const id of SECTION_IDS) {
    const text = (await page.locator('#' + id).textContent()).trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/undefined|NaN/);
  }
  await expect(page.locator('#overview-content .rpt-next')).toContainText(/Start/);
  await expect(page.locator('#curriculum-content')).toContainText(/not started/i);
  expect(errors).toEqual([]);
});

test('light mode renders the charts without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/pages/report.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('rt-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.RTReport);
  await seedState(page, makeYearState());
  await page.evaluate(() => window.RTReport.render());
  expect(await page.locator('html.light').count()).toBe(1);
  expect(await page.locator('#skills-radar').count()).toBe(1);
  expect(errors).toEqual([]);
});
