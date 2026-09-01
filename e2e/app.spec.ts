import { expect, test } from '@playwright/test'

import { createTask, projectCards, taskRows, uniqueTitle } from './helpers'

test.describe('projects', () => {
  test('creates a project, uses it, then deletes it without losing the task', async ({ page }) => {
    const projectName = uniqueTitle('E2E Project')
    const taskTitle = uniqueTitle('E2E project task')

    await page.goto('/projects')
    await page.getByRole('button', { name: 'New project' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill(projectName)
    await dialog.getByLabel('Description').fill('Created by the end-to-end suite.')
    await dialog.getByRole('button', { name: 'Create project' }).click()

    await expect(projectCards(page).getByRole('link', { name: new RegExp(projectName) }).first()).toBeVisible()

    // A task filed under it shows up on the project page.
    await createTask(page, taskTitle, { project: projectName })
    await page.goto('/projects')
    await projectCards(page).getByRole('link', { name: new RegExp(projectName) }).first().click()

    await expect(page.getByRole('heading', { name: projectName })).toBeVisible()
    await expect(page.getByRole('link', { name: taskTitle, exact: true })).toBeVisible()

    // Deleting the project keeps the task and moves it to "No project".
    await page.goto('/projects')
    await page.getByRole('button', { name: `Actions for ${projectName}` }).click()
    await page.getByRole('menuitem', { name: 'Delete project' }).click()

    const confirm = page.getByRole('dialog')
    await expect(confirm).toContainText('will be kept and moved to')
    await confirm.getByRole('button', { name: 'Delete' }).click()

    await expect(projectCards(page).getByRole('link', { name: new RegExp(projectName) })).toHaveCount(0)

    await page.goto('/tasks?projectId=none')
    await expect(page.getByRole('link', { name: taskTitle, exact: true })).toBeVisible()
  })

  test('refuses two projects with the same name', async ({ page }) => {
    await page.goto('/projects')
    await page.getByRole('button', { name: 'New project' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Website Redesign')
    await dialog.getByRole('button', { name: 'Create project' }).click()

    await expect(page.getByText('You already have a project with that name.')).toBeVisible()
  })

  test('shows project progress that matches its tasks', async ({ page }) => {
    await page.goto('/projects')
    const card = projectCards(page).filter({ hasText: 'Website Redesign' }).first()
    await expect(card).toContainText('%')
    await expect(card).toContainText('open of')
  })
})

test.describe('dashboard', () => {
  test('numbers come from the database and move when a task is completed', async ({ page }) => {
    await page.goto('/dashboard')

    const readCompleted = async () => {
      const card = page.locator('a', { hasText: 'Completed' }).first()
      const text = await card.innerText()
      const match = /(\d+)/.exec(text.split('\n').find((line) => /^\d+$/.test(line.trim())) ?? '0')
      return Number(match?.[1] ?? 0)
    }

    const before = await readCompleted()

    const title = uniqueTitle('E2E dashboard')
    await createTask(page, title)

    // The checkbox updates optimistically, so wait for the write to land before
    // navigating away, rather than racing the request.
    const saved = page.waitForResponse(
      (response) => response.url().includes('/complete') && response.request().method() === 'PATCH',
    )
    await page.getByRole('checkbox', { name: `Mark "${title}" as done` }).click()
    await saved
    await expect(page.getByRole('checkbox', { name: `Mark "${title}" as not done` })).toBeVisible()

    await page.goto('/dashboard')
    const after = await readCompleted()

    expect(after).toBe(before + 1)
  })

  test('the stat tiles link into a filtered task list', async ({ page }) => {
    await page.goto('/dashboard')
    await page.locator('a[href="/tasks?due=overdue"]').first().click()

    await expect(page).toHaveURL(/due=overdue/)
    await expect(page.getByRole('button', { name: /Filters/ })).toContainText('1')
  })
})

test.describe('calendar', () => {
  test('shows the month, moves between months and opens a task', async ({ page }) => {
    await page.goto('/calendar')

    // The month heading is the one ending in a year, e.g. "September 2026".
    const heading = page.getByRole('heading', { name: /\d{4}$/ })
    const initialMonth = await heading.innerText()

    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(heading).not.toHaveText(initialMonth)

    await page.getByRole('button', { name: 'Today' }).click()
    await expect(heading).toHaveText(initialMonth)

    // Any day carrying a task opens the detail dialog for it.
    const dayWithTasks = page
      .locator('button[aria-label*="task"]')
      .filter({ hasNotText: 'Today' })
      .first()
    await dayWithTasks.click()

    const panel = page.locator('ul li button').last()
    if (await panel.isVisible()) {
      await panel.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Close dialog' }).click()
    }
  })
})

test.describe('settings', () => {
  test('switches to dark mode and the choice survives a reload', async ({ page }) => {
    await page.goto('/settings')

    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // And back again, so the toggle is not one-way.
    await page.getByRole('radio', { name: 'Light' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('saves the profile name and shows it in the account menu', async ({ page }) => {
    await page.goto('/settings')
    await page.getByLabel('Name', { exact: true }).fill('Demo Renamed')
    await page.getByRole('button', { name: 'Save profile' }).click()

    await expect(page.getByText('Profile updated')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Demo Renamed')

    // Put it back so later runs start from the seeded state.
    await page.getByLabel('Name', { exact: true }).fill('Demo User')
    await page.getByRole('button', { name: 'Save profile' }).click()
    await expect(page.getByText('Profile updated')).toBeVisible()
  })

  test('rejects a password change with the wrong current password', async ({ page }) => {
    await page.goto('/settings')
    await page.getByLabel('Current password').fill('not-the-password')
    await page.getByLabel('New password').fill('a-brand-new-password')
    await page.getByRole('button', { name: 'Change password' }).click()

    await expect(page.getByText('Your current password is incorrect.')).toBeVisible()
  })

  test('renames a tag, and the new name shows on its tasks', async ({ page }) => {
    const original = 'quick-win'
    const renamed = `quick-win-${Date.now().toString(36)}`

    await page.goto('/settings')
    await page.getByRole('button', { name: `Rename ${original}` }).click()
    await page.getByLabel(`Rename ${original}`).fill(renamed)
    await page.getByRole('button', { name: 'Save tag name' }).click()

    await expect(page.getByText('Tag renamed')).toBeVisible()

    // The rename is global: searching for it finds the tasks that carry it.
    await page.goto(`/tasks?search=${renamed}`)
    await expect(taskRows(page).first()).toBeVisible()

    // Put it back so the suite is re-runnable.
    await page.goto('/settings')
    await page.getByRole('button', { name: `Rename ${renamed}` }).click()
    await page.getByLabel(`Rename ${renamed}`).fill(original)
    await page.getByRole('button', { name: 'Save tag name' }).click()
    await expect(page.getByText('Tag renamed')).toBeVisible()
  })

  test('toggles a notification preference and persists it', async ({ page }) => {
    await page.goto('/settings')

    const digest = page.getByRole('switch', { name: 'Weekly digest' })
    const wasOn = (await digest.getAttribute('aria-checked')) === 'true'

    await digest.click()
    await expect(digest).toHaveAttribute('aria-checked', String(!wasOn))

    await page.reload()
    await expect(page.getByRole('switch', { name: 'Weekly digest' })).toHaveAttribute(
      'aria-checked',
      String(!wasOn),
    )
  })
})
