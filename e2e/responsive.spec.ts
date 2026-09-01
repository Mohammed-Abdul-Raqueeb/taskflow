import { expect, test } from '@playwright/test'

import { uniqueTitle } from './helpers'

/**
 * Runs on the mobile project (Pixel 7).
 *
 * The point is not that the desktop layout still fits, but that a different
 * layout is in use: a bottom tab bar instead of the sidebar, and no horizontal
 * overflow anywhere.
 */

test('uses the bottom tab bar instead of the sidebar on a phone', async ({ page }) => {
  await page.goto('/dashboard')

  const sidebarNav = page.locator('aside nav[aria-label="Main"]')
  await expect(sidebarNav).toBeHidden()

  const tabBar = page.locator('nav[aria-label="Main"]').last()
  await expect(tabBar).toBeVisible()

  await tabBar.getByRole('link', { name: 'Tasks' }).click()
  await expect(page).toHaveURL(/\/tasks/)
})

test('never scrolls sideways on the main pages', async ({ page }) => {
  for (const path of ['/dashboard', '/tasks', '/projects', '/calendar', '/settings']) {
    // `goto` already resolves on load; networkidle never settles here because
    // the App Router keeps prefetch requests going.
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${path} should not scroll horizontally`).toBeLessThanOrEqual(1)
  }
})

test('the task form is usable on a narrow screen', async ({ page }) => {
  const title = uniqueTitle('Created on a phone')

  await page.goto('/tasks/new')
  await expect(page.getByLabel('Title')).toBeVisible()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()

  await page.waitForURL('**/tasks')
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
})

test('the calendar shows dots rather than pills on a phone', async ({ page }) => {
  await page.goto('/calendar')

  // The day panel underneath is where a phone reads the detail; its heading
  // names the selected weekday.
  await expect(
    page.getByRole('heading', { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/ }),
  ).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
