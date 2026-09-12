import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './quality-tests/browser',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } }
  ],
  use: {
    baseURL: 'http://127.0.0.1:5180',
    browserName: 'chromium',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'bun run start',
      url: 'http://127.0.0.1:5181/api/health',
      reuseExistingServer: process.env.SKILLET_TEST_REUSE_SERVER === '1' && !process.env.CI
    },
    {
      command: 'bun run --cwd apps/web preview -- --host 127.0.0.1 --port 5180',
      url: 'http://127.0.0.1:5180',
      reuseExistingServer: process.env.SKILLET_TEST_REUSE_SERVER === '1' && !process.env.CI
    }
  ]
});
