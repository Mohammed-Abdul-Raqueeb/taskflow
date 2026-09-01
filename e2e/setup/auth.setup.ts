import { test as setup } from '@playwright/test'

import { DEMO_EMAIL, DEMO_PASSWORD, SESSION_FILE } from '../helpers'

/**
 * Signs in once and saves the session for the rest of the suite.
 *
 * Besides being much faster than signing in per test, it keeps the run inside
 * the login rate limit -- which is a real protection worth leaving switched on
 * while the tests run, rather than something to disable for convenience.
 *
 * `auth.spec.ts` deliberately opts out of this and drives the real sign-in form.
 */
setup('authenticate as the demo user', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')

  await page.context().storageState({ path: SESSION_FILE })
})
