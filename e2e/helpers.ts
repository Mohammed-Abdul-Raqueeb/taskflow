import { expect, type Page } from '@playwright/test'

/** Where the shared signed-in session is cached between projects. */
export const SESSION_FILE = '.playwright/demo-session.json'

export const DEMO_EMAIL = 'demo@taskflow.app'
export const DEMO_PASSWORD = 'demo1234'

/** The second seeded account, used to prove one user cannot see another's data. */
export const OTHER_EMAIL = 'alex@taskflow.app'
export const OTHER_PASSWORD = 'demo1234'

export async function signIn(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Open account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL('**/login')
}

/** A title unique to this run, so parallel-ish runs never collide. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

export async function createTask(
  page: Page,
  title: string,
  options: { priority?: string; status?: string; project?: string; tags?: string[] } = {},
) {
  await page.goto('/tasks/new')
  await page.getByLabel('Title').fill(title)

  if (options.priority) {
    await page.getByLabel('Priority').selectOption({ label: options.priority })
  }
  if (options.status) {
    await page.getByLabel('Status').selectOption({ label: options.status })
  }
  if (options.project) {
    await page.getByLabel('Project').selectOption({ label: options.project })
  }
  for (const tag of options.tags ?? []) {
    await page.getByLabel('Add a tag').fill(tag)
    await page.getByLabel('Add a tag').press('Enter')
  }

  await page.getByRole('button', { name: 'Create task' }).click()
  await page.waitForURL('**/tasks')
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
}

/**
 * The rows of the task list, scoped by the list's accessible name.
 *
 * A bare `getByRole('listitem')` would also pick up the sidebar navigation and
 * the project shortcuts, which are lists too.
 */
export function taskRows(page: Page) {
  return page.getByRole('list', { name: 'Tasks' }).getByRole('listitem')
}

export function projectCards(page: Page) {
  return page.getByRole('list', { name: 'Projects' }).getByRole('listitem')
}

/** Types into the search box and waits out the debounce. */
export async function search(page: Page, term: string) {
  const box = page.getByLabel('Search tasks')
  await box.fill(term)
  await page.waitForTimeout(600)
}
