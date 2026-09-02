// Self-contained: starts tests/serve.js on its own port (5501) so it never collides
// with VS Code Live Server (5500) or any other dev server. reuseExistingServer is off
// on purpose: the audit asserts headers that only tests/serve.js sends.
import { defineConfig } from '@playwright/test';

export const TEST_PORT = 5501;
export const BASE_URL = 'http://127.0.0.1:' + TEST_PORT;

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.js/,
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    headless: true
  },
  webServer: {
    command: 'node tests/serve.js',
    env: { PORT: String(TEST_PORT) },
    url: BASE_URL + '/',
    reuseExistingServer: false,
    timeout: 10000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
