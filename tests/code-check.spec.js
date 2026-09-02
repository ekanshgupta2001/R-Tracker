// Phase 5 gate (Playwright): pasting a known-good sample verifies the phase and unlocks the next;
// a known-bad sample shows "NEEDS WORK" with the expected hint and leaves the phase unverified.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, unlockPhase } from './helpers/state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = f => fs.readFileSync(path.join(ROOT, 'tests/fixtures/code-samples', f), 'utf8');

test.beforeEach(async ({ page }) => { page.on('dialog', d => d.accept()); });

async function openPhase1(page) {
  await page.goto('/pages/curriculum.html', { waitUntil: 'load' });
  await page.waitForSelector('.tl-node');
  await unlockPhase(page, 'phase1');
  await page.click('.tl-node[data-phase="phase1"]');
  await page.click('.curr-action-btn.btn-start');
  await page.waitForSelector('#code-editor-phase1');
}

test('a good submission passes the structural check, verifies the phase and unlocks the next', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openPhase1(page);
  await page.fill('#code-editor-phase1', sample('phase1-good.java'));
  await page.click('#ai-review-btn-phase1');
  const card = page.locator('#ai-result-phase1');
  await expect(card).toContainText('VERIFIED');
  await expect(card).toContainText('Structural check only');
  await expect(card).toContainText('Phase 2 is now unlocked');

  const s = await readState(page);
  expect(s.curriculum.phases.phase1.status).toBe('verified');
  expect(s.curriculum.phases.phase1.verifiedBy).toBe('auto');
  expect(s.curriculum.phases.phase1.bestScore).toBeGreaterThanOrEqual(75);
  expect(s.curriculum.phases.phase1.reviews.length).toBe(1);
  expect(s.curriculum.phases.phase1.reviews[0].result.grader).toBe('structural');
  expect(s.curriculum.phases.phase1.submittedCode).toContain('hardwareMap.get');
  expect(s.curriculum.phases.phase2.status).toBe('not_started');
  const att = s.curriculum.attempts.find(a => a.kind === 'code');
  expect(att.graded).toBe(true);
  expect(att.correct).toBe(true);
  expect(await page.locator('.tl-node[data-phase="phase2"]').getAttribute('data-status')).toBe('not_started');
  expect(errors).toEqual([]);
});

test('a bad submission gets NEEDS WORK with the right hint and stays unverified', async ({ page }) => {
  await openPhase1(page);
  await page.fill('#code-editor-phase1', sample('phase1-bad.java'));
  await page.click('#ai-review-btn-phase1');
  const card = page.locator('#ai-result-phase1');
  await expect(card).toContainText('NEEDS WORK');
  await expect(card).toContainText('Inverts the joystick Y axis');
  await expect(card).toContainText('-gamepad1.left_stick_y');
  await expect(card).toContainText('sleep() inside the TeleOp loop');
  await expect(card).toContainText('Revise');

  const s = await readState(page);
  expect(s.curriculum.phases.phase1.status).toBe('in_progress');
  expect(s.curriculum.phases.phase1.lastStatus).toBe('graded');
  expect(s.curriculum.phases.phase1.lastScore).toBeLessThan(75);
  const att = s.curriculum.attempts.find(a => a.kind === 'code');
  expect(att.correct).toBe(false);
  expect(await page.locator('.tl-node[data-phase="phase2"]').getAttribute('data-status')).toBe('locked');

  // Check history lists the attempt as "Needs work"
  await page.click('#review-history-phase1 .review-history-toggle');
  await expect(page.locator('#rh-list-phase1')).toContainText('Needs work');

  // The submission is in the export
  const exported = await page.evaluate(() => JSON.parse(window.RTStore.exportJSON()));
  expect(exported.curriculum.phases.phase1.reviews[0].code).toContain('BadTeleOp');
});

test('the strategy module is a mentor-review submission, not a pattern check', async ({ page }) => {
  await page.goto('/pages/curriculum.html', { waitUntil: 'load' });
  await page.waitForSelector('.tl-node');
  const r = await page.evaluate(() => window.checkCode('advanced_strategy', 'Expected value: 0.8 x 20 = 16 points'));
  expect(r.status).toBe('reflection');
  expect(r.passed).toBeNull();
});
