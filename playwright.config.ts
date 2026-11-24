import { defineConfig, devices } from '@playwright/test';

// Local run: builds the app and serves it with the stand-in API on the preview server.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['screens.spec.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3901', trace: 'retain-on-failure', locale: 'en-US', timezoneId: 'America/Chicago' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:3901',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
