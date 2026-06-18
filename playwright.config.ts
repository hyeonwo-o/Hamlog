import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ?? '4000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: `PORT=${PORT} npm run server`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 30_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
