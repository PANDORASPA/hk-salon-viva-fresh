import { defineConfig } from '@playwright/test'
import { loadE2EEnvironment } from './lib/e2e/runtime-preflight.mjs'

loadE2EEnvironment()
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.mjs',
  globalTeardown: './e2e/global-teardown.mjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
