import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright config for the SCRUM-119 QA regression suite.
 * Skips the project-wide globalSetup that requires a local Java service
 * on :4002 — this suite hits the deployed Railway services through the
 * Next.js BFFs instead. Outputs the HTML report to test-results/scrum-119/.
 */
const reportDir = './test-results/scrum-119';

export default defineConfig({
  testDir: './e2e',
  testMatch: /scrum-119-qa\.spec\.ts/,
  fullyParallel: true,
  retries: 0,
  workers: 1,
  outputDir: `${reportDir}/artifacts`,
  reporter: [
    ['html', { outputFolder: `${reportDir}/html`, open: 'never' }],
    ['line'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox']  } },
    { name: 'webkit',   use: { ...devices['Desktop Safari']   } },
  ],
});
