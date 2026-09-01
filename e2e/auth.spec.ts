import { expect, test } from '@playwright/test'

import { DEMO_EMAIL, DEMO_PASSWORD, signIn, signOut, uniqueTitle } from './helpers'

test.describe('authentication', () => {
  test('sends a signed-out visitor to sign in, and back where they were going', async ({ page }) => {
    await page.goto('/tasks')

    await expect(page).toHaveURL(/\/login\?next=%2Ftasks/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

    await page.getByLabel('Email').fill(DEMO_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/tasks/)
  })

  test('rejects a wrong password without saying whether the account exists', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(DEMO_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Incorrect email or password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('validates the form before it reaches the server', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Name').fill('Someone')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
  })

  test('signs a new account up, straight into an empty dashboard', async ({ page }) => {
    const email = `${uniqueTitle('new').replace(/\s+/g, '-')}@example.com`

    await page.goto('/signup')
    await page.getByLabel('Name').fill('Fresh Account')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('a-good-password')
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: /Hello, Fresh/ })).toBeVisible()
    // A brand-new account has no tasks, so the dashboard shows its empty state
    // rather than a wall of zeroes.
    await expect(page.getByText('Your dashboard is waiting on its first task')).toBeVisible()
  })

  test('rejects an email that is already registered', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Name').fill('Impostor')
    await page.getByLabel('Email').fill(DEMO_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('another-password')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('An account with that email already exists.')).toBeVisible()
  })

  test('signs out and locks the protected pages again', async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/dashboard/)

    await signOut(page)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('authorisation', () => {
  test('one user never sees another user\'s tasks', async ({ page }) => {
    // The seed gives Alex two tasks whose titles start with "Alex only".
    await signIn(page)
    await page.goto('/tasks')

    await page.getByLabel('Search tasks').fill('Alex only')
    await page.waitForTimeout(600)

    await expect(page.getByText('No tasks match these filters')).toBeVisible()
  })

  test('a task id from another account is not found', async ({ page, request }) => {
    // Sign in as Alex, capture one of their task ids from the API.
    await signIn(page, 'alex@taskflow.app', 'demo1234')
    const alexTasks = await page.request.get('/api/tasks')
    const alexPayload = await alexTasks.json()
    const alexTaskId: string = alexPayload.items[0].id
    expect(alexTaskId).toBeTruthy()

    await signOut(page)

    // Now as the demo user, the same id must be unreachable.
    await signIn(page)
    const response = await page.request.get(`/api/tasks/${alexTaskId}`)
    expect(response.status()).toBe(404)

    await page.goto(`/tasks/${alexTaskId}/edit`)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

    void request
  })

  test('the API refuses unauthenticated requests', async ({ request }) => {
    for (const path of ['/api/tasks', '/api/projects', '/api/stats', '/api/settings']) {
      const response = await request.get(path)
      expect(response.status(), `${path} should require authentication`).toBe(401)
    }
  })
})
