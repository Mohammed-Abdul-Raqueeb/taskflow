import { expect, test } from '@playwright/test'

import { createTask, search, taskRows, uniqueTitle } from './helpers'

test.describe('task CRUD', () => {
  test('creates a task with every field filled in', async ({ page }) => {
    const title = uniqueTitle('E2E full task')

    await page.goto('/tasks/new')
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Description').fill('Created by the end-to-end suite.')
    await page.getByLabel('Priority').selectOption({ label: 'Urgent' })
    await page.getByLabel('Status').selectOption({ label: 'In progress' })
    await page.getByLabel('Project').selectOption({ label: 'Website Redesign' })
    await page.getByRole('button', { name: 'Tomorrow' }).click()
    await page.getByLabel('Add a tag').fill('e2e')
    await page.getByLabel('Add a tag').press('Enter')

    await page.getByRole('button', { name: 'Create task' }).click()
    await page.waitForURL('**/tasks')

    const row = taskRows(page).filter({ has: page.getByRole('link', { name: title, exact: true }) })
    await expect(row.first()).toContainText('Urgent')
    await expect(row.first()).toContainText('In progress')
    await expect(row.first()).toContainText('Website Redesign')
    await expect(row.first()).toContainText('e2e')
    await expect(row.first()).toContainText('Tomorrow')
  })

  test('requires a title', async ({ page }) => {
    await page.goto('/tasks/new')
    await page.getByRole('button', { name: 'Create task' }).click()

    await expect(page.getByText('Title is required', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/tasks\/new/)
  })

  test('edits a task and shows the change in the list', async ({ page }) => {
    const title = uniqueTitle('E2E edit me')
    await createTask(page, title, { priority: 'Low' })

    await page.getByRole('link', { name: title, exact: true }).click()
    await page.waitForURL(/\/tasks\/.+\/edit/)

    const renamed = `${title} (edited)`
    await page.getByLabel('Title').fill(renamed)
    await page.getByLabel('Priority').selectOption({ label: 'High' })
    await page.getByRole('button', { name: 'Save changes' }).click()

    await page.waitForURL('**/tasks')
    const row = taskRows(page).filter({ has: page.getByRole('link', { name: renamed, exact: true }) })
    await expect(row.first()).toContainText('High')
  })

  test('completes and reopens a task from the checkbox', async ({ page }) => {
    const title = uniqueTitle('E2E toggle')
    await createTask(page, title)

    const checkbox = page.getByRole('checkbox', { name: `Mark "${title}" as done` })
    await checkbox.click()

    const undo = page.getByRole('checkbox', { name: `Mark "${title}" as not done` })
    await expect(undo).toBeVisible()

    const row = taskRows(page).filter({ has: page.getByRole('link', { name: title, exact: true }) })
    await expect(row.first()).toContainText('Completed')

    // The change is real, not just local: it survives a reload.
    await page.reload()
    await expect(page.getByRole('checkbox', { name: `Mark "${title}" as not done` })).toBeVisible()

    await page.getByRole('checkbox', { name: `Mark "${title}" as not done` }).click()
    await expect(page.getByRole('checkbox', { name: `Mark "${title}" as done` })).toBeVisible()
  })

  test('deletes a task only after confirmation', async ({ page }) => {
    const title = uniqueTitle('E2E delete')
    await createTask(page, title)

    await page.getByRole('button', { name: `Actions for ${title}` }).click()
    await page.getByRole('menuitem', { name: 'Delete task' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Delete this task?')

    // Backing out leaves the task alone.
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()

    await page.getByRole('button', { name: `Actions for ${title}` }).click()
    await page.getByRole('menuitem', { name: 'Delete task' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0)
  })
})

test.describe('search, filter and sort', () => {
  test('searches by title', async ({ page }) => {
    await page.goto('/tasks')
    await search(page, 'pricing page')

    await expect(page.getByRole('link', { name: /pricing page/i })).toBeVisible()
    await expect(page.getByText(/^1 task$/)).toBeVisible()
  })

  test('searches by description text that is not in any title', async ({ page }) => {
    await page.goto('/tasks')
    await search(page, 'CRDTs')

    await expect(page.getByRole('link', { name: /Offline sync spike/i })).toBeVisible()
  })

  test('searches by tag name', async ({ page }) => {
    await page.goto('/tasks')
    await search(page, 'finance')

    // Three seeded tasks carry the "finance" tag.
    const rows = taskRows(page)
    await expect(rows.first()).toBeVisible()
    await expect(page.getByText('No tasks match these filters')).toHaveCount(0)
  })

  test('shows an empty state, and recovers, when nothing matches', async ({ page }) => {
    await page.goto('/tasks')
    await search(page, 'zzzz-nothing-matches-this')

    await expect(page.getByText('No tasks match these filters')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('No tasks match these filters')).toHaveCount(0)
  })

  test('filters by status and keeps the filter in the URL', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: /Filters/ }).click()
    await page.getByRole('button', { name: 'Completed', exact: true }).click()

    await expect(page).toHaveURL(/status=COMPLETED/)

    const badges = page.getByText('Completed', { exact: true })
    await expect(badges.first()).toBeVisible()

    // Reloading the filtered URL gives the same view back.
    await page.reload()
    await expect(page.getByRole('button', { name: /Filters/ })).toContainText('1')
  })

  test('filters by priority', async ({ page }) => {
    await page.goto('/tasks?priority=URGENT')
    const rows = taskRows(page)
    await expect(rows.first()).toBeVisible()

    const count = await rows.count()
    for (let index = 0; index < count; index += 1) {
      await expect(rows.nth(index)).toContainText('Urgent')
    }
  })

  test('filters to overdue work and excludes completed tasks', async ({ page }) => {
    await page.goto('/tasks?due=overdue')
    const rows = taskRows(page)
    await expect(rows.first()).toBeVisible()

    const count = await rows.count()
    for (let index = 0; index < count; index += 1) {
      await expect(rows.nth(index)).not.toContainText('Completed')
    }
  })

  test('sorts by title, and the order actually changes', async ({ page }) => {
    await page.goto('/tasks?sort=title&direction=asc&pageSize=100')
    const ascending = await taskRows(page).first().textContent()

    await page.goto('/tasks?sort=title&direction=desc&pageSize=100')
    const descending = await taskRows(page).first().textContent()

    expect(ascending).not.toEqual(descending)
  })

  test('paginates through a long list', async ({ page }) => {
    await page.goto('/tasks?pageSize=5')

    // Scoped to the pagination bar: in dev, Next.js injects its own "Next" button.
    const pager = page.getByRole('navigation', { name: 'Task list pages' })
    await expect(page.getByText(/Showing 1-5 of/)).toBeVisible()
    await pager.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText(/Showing 6-10 of/)).toBeVisible()
    await expect(page).toHaveURL(/page=2/)
  })

  test('rejects a hand-crafted invalid filter instead of crashing', async ({ page }) => {
    await page.goto('/tasks?status=NOT_A_STATUS')
    await expect(page.getByText('That filter is not valid')).toBeVisible()
    await page.getByRole('link', { name: 'Reset filters' }).click()
    await expect(page).toHaveURL(/\/tasks$/)
  })
})
