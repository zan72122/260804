import { defineConfig } from '@playwright/test';

/**
 * Four required viewports (iPhone/iPad, portrait/landscape).
 * The environment's preinstalled Chromium is used via executablePath —
 * never download browsers here.
 */
const chromiumPath = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: { executablePath: chromiumPath },
    hasTouch: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'iphone-portrait',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    },
    {
      name: 'iphone-landscape',
      use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 },
      testMatch: /full-loop\.spec\.ts/,
    },
    {
      name: 'ipad-portrait',
      use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 },
      testMatch: /full-loop\.spec\.ts/,
    },
    {
      name: 'ipad-landscape',
      use: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 },
      testMatch: /full-loop\.spec\.ts/,
    },
  ],
});
