import { defineConfig, devices } from '@playwright/test';

// Takes the screenshots: BASE_URL and SCREENS_DIR can point somewhere else.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['screens.spec.ts'],
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://multilingual-pilot-demo.vercel.app',
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
