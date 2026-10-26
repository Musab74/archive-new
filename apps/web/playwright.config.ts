/**
 * Playwright config for the AINEX e2e harness (apps/web/e2e). The stack (local MariaDB + API + vite preview) is started separately
 * with `node e2e/stack.mjs up`; this config only reads <E2E_RUN_DIR>/stack.json for the base URL and writes every output
 * (test-results, HTML report, screenshots) into the run folder — never into the repository. See e2e/README.md.
 */
import { defineConfig } from '@playwright/test';
import { loadStack, PHONE_UA } from './e2e/support/stack';

const stack = loadStack();
const workers = Number(process.env.E2E_WORKERS ?? 1);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: `${stack.runDir}/playwright/test-results`,
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: false,
  workers: Number.isInteger(workers) && workers >= 1 && workers <= 2 ? workers : 1, // gentle on the shared web server: 1 (or 2)
  retries: 0,
  forbidOnly: true,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: `${stack.runDir}/playwright/report`, open: 'never' }],
    ['json', { outputFile: `${stack.runDir}/playwright/results.json` }],
  ],
  use: {
    baseURL: stack.baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false } },
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: PHONE_UA } },
  ],
});
