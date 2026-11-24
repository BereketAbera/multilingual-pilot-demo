import { defineConfig, devices } from '@playwright/test';

// The same browser tests against a deployed site: BASE_URL=https://... pnpm test:live
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['screens.spec.ts'],
  fullyParallel: true,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://multilingual-pilot-demo.vercel.app',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
