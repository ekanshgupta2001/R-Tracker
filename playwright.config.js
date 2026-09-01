// Self-contained: starts tests/serve.js (no Live Server needed).
import { defineConfig } from '@playwright/test';

export const BASE_URL = 'http://127.0.0.1:5500';

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
    url: BASE_URL + '/',
    reuseExistingServer: true,
    timeout: 10000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
