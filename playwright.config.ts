import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * The suite drives a real Next.js server backed by its own seeded database
 * (see scripts/e2e-server.mjs), so these tests exercise the same stack a user
 * would: middleware, Server Components, Route Handlers, PostgreSQL.
 *
 * Projects are split by what they need from authentication:
 *
 *   setup       signs in once and saves the session
 *   auth-flows  drives the real sign-in/sign-up forms, so it starts signed out
 *   desktop     the feature suite, reusing the saved session
 *   mobile      the responsive suite on a phone viewport
 *
 * Reusing the session keeps the run inside the login rate limit, which stays
 * switched on rather than being disabled for the tests' convenience.
 */

const PORT = Number(process.env.E2E_PORT ?? 3210)
const BASE_URL = `http://localhost:${PORT}`
const SESSION_FILE = '.playwright/demo-session.json'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // The projects share one seeded account, so serial runs keep assertions
  // about counts and list contents meaningful.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth-flows',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop',
      testMatch: /(tasks|app)\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: SESSION_FILE },
    },
    {
      name: 'mobile',
      testMatch: /responsive\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'], storageState: SESSION_FILE },
    },
  ],

  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { E2E_PORT: String(PORT), PGLITE_DATA_DIR: '.pglite-e2e' },
  },
})
