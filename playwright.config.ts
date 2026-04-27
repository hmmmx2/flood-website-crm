import { defineConfig, devices } from '@playwright/test';

const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const reportDir = `./test-results/${date}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: `${reportDir}/artifacts`,
  reporter: [
    ['html', { outputFolder: `${reportDir}/html`, open: 'never' }],
    ['json', { outputFile: `${reportDir}/results.json` }],
    ['line'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: './e2e/.auth-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
