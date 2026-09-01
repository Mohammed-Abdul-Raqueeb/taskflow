import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getDashboardStats } from '@/lib/services/stats'
import { setTaskCompletion } from '@/lib/services/tasks'
import { createTestDatabase, type TestDatabase } from './helpers/db'
import { UTC, makeProject, makeTask, makeUser, utcDaysFromNow } from './helpers/factories'
import type { UserDTO } from '@/types'

/**
 * Dashboard numbers are derived from the database on every request. These tests
 * pin the arithmetic against a known fixture, with an explicit `now` so the
 * "overdue" and "due today" boundaries do not move while the suite runs.
 */

let ctx: TestDatabase
let user: UserDTO

const NOW = new Date(utcDaysFromNow(0, 9))
const AT = { timeZone: UTC, now: NOW, weekStartsOn: 1 }

beforeAll(async () => {
  ctx = await createTestDatabase()
})
afterAll(async () => {
  await ctx.close()
})
beforeEach(async () => {
  await ctx.reset()
  user = await makeUser(ctx.db)
})

describe('an account with no tasks', () => {
  it('reports zeros and a 0% completion rate rather than NaN', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)

    expect(stats).toMatchObject({
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      dueToday: 0,
      highPriority: 0,
      completionRate: 0,
    })
    expect(stats.recentTasks).toEqual([])
    expect(stats.upcomingTasks).toEqual([])
    expect(Number.isNaN(stats.completionRate)).toBe(false)
  })
})

describe('headline counters', () => {
  beforeEach(async () => {
    // 3 completed, 5 outstanding.
    await makeTask(ctx.db, user.id, { status: 'COMPLETED', priority: 'LOW' })
    await makeTask(ctx.db, user.id, { status: 'COMPLETED', priority: 'MEDIUM' })
    await makeTask(ctx.db, user.id, {
      status: 'COMPLETED',
      priority: 'URGENT',
      // Past its due date, but completed, so it is not overdue.
      dueDate: utcDaysFromNow(-4, 12),
    })

    await makeTask(ctx.db, user.id, { status: 'TODO', priority: 'URGENT', dueDate: utcDaysFromNow(-2, 12) })
    await makeTask(ctx.db, user.id, {
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: utcDaysFromNow(-1, 12),
    })
    await makeTask(ctx.db, user.id, { status: 'TODO', priority: 'HIGH', dueDate: utcDaysFromNow(0, 18) })
    await makeTask(ctx.db, user.id, { status: 'TODO', priority: 'MEDIUM', dueDate: utcDaysFromNow(3, 12) })
    await makeTask(ctx.db, user.id, { status: 'TODO', priority: 'LOW' })
  })

  it('counts totals, completions and the remainder', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)

    expect(stats.total).toBe(8)
    expect(stats.completed).toBe(3)
    expect(stats.pending).toBe(5)
    expect(stats.pending).toBe(stats.total - stats.completed)
  })

  it('counts only incomplete past-due tasks as overdue', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.overdue).toBe(2)
  })

  it('counts tasks due today', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.dueToday).toBe(1)
  })

  it('counts outstanding high and urgent work', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)
    // URGENT + HIGH + HIGH among the incomplete tasks; the completed URGENT one
    // is excluded because it is no longer outstanding.
    expect(stats.highPriority).toBe(3)
  })

  it('computes the completion rate as a rounded percentage', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.completionRate).toBe(Math.round((3 / 8) * 100))
    expect(stats.completionRate).toBe(38)
  })

  it('breaks tasks down by status and by priority', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)

    expect(stats.byStatus).toEqual({ TODO: 4, IN_PROGRESS: 1, COMPLETED: 3 })
    expect(stats.byPriority).toEqual({ LOW: 2, MEDIUM: 2, HIGH: 2, URGENT: 2 })

    const statusTotal = Object.values(stats.byStatus).reduce((sum, value) => sum + value, 0)
    const priorityTotal = Object.values(stats.byPriority).reduce((sum, value) => sum + value, 0)
    expect(statusTotal).toBe(stats.total)
    expect(priorityTotal).toBe(stats.total)
  })

  it('tracks the numbers as tasks are completed', async () => {
    const before = await getDashboardStats(ctx.db, user.id, AT)

    const open = await makeTask(ctx.db, user.id, { status: 'TODO' })
    await setTaskCompletion(ctx.db, user.id, open.id, true)

    const after = await getDashboardStats(ctx.db, user.id, AT)
    expect(after.total).toBe(before.total + 1)
    expect(after.completed).toBe(before.completed + 1)
    expect(after.pending).toBe(before.pending)
  })
})

describe('project breakdown', () => {
  it('groups by project and keeps unassigned tasks under their own bucket', async () => {
    const website = await makeProject(ctx.db, user.id, { name: 'Website' })
    const mobile = await makeProject(ctx.db, user.id, { name: 'Mobile' })

    await makeTask(ctx.db, user.id, { projectId: website.id, status: 'COMPLETED' })
    await makeTask(ctx.db, user.id, { projectId: website.id, status: 'TODO' })
    await makeTask(ctx.db, user.id, { projectId: website.id, status: 'TODO' })
    await makeTask(ctx.db, user.id, { projectId: mobile.id, status: 'COMPLETED' })
    await makeTask(ctx.db, user.id, { status: 'TODO' })

    const stats = await getDashboardStats(ctx.db, user.id, AT)

    const websiteRow = stats.byProject.find((row) => row.projectId === website.id)
    expect(websiteRow).toMatchObject({ name: 'Website', total: 3, completed: 1 })

    const mobileRow = stats.byProject.find((row) => row.projectId === mobile.id)
    expect(mobileRow).toMatchObject({ name: 'Mobile', total: 1, completed: 1 })

    const unassigned = stats.byProject.find((row) => row.projectId === null)
    expect(unassigned).toMatchObject({ name: 'No project', total: 1 })

    const grandTotal = stats.byProject.reduce((sum, row) => sum + row.total, 0)
    expect(grandTotal).toBe(stats.total)
  })
})

describe('dashboard lists', () => {
  it('returns the most recently created tasks first', async () => {
    await makeTask(ctx.db, user.id, { title: 'First' })
    await makeTask(ctx.db, user.id, { title: 'Second' })
    await makeTask(ctx.db, user.id, { title: 'Third' })

    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.recentTasks[0]?.title).toBe('Third')
    expect(stats.recentTasks).toHaveLength(3)
  })

  it('lists upcoming tasks by due date and excludes completed ones', async () => {
    await makeTask(ctx.db, user.id, { title: 'Later', dueDate: utcDaysFromNow(9, 12) })
    await makeTask(ctx.db, user.id, { title: 'Sooner', dueDate: utcDaysFromNow(2, 12) })
    await makeTask(ctx.db, user.id, { title: 'Past', dueDate: utcDaysFromNow(-2, 12) })
    await makeTask(ctx.db, user.id, {
      title: 'Done',
      status: 'COMPLETED',
      dueDate: utcDaysFromNow(1, 12),
    })

    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.upcomingTasks.map((task) => task.title)).toEqual(['Sooner', 'Later'])
  })

  it('lists overdue tasks oldest first', async () => {
    await makeTask(ctx.db, user.id, { title: 'Two days late', dueDate: utcDaysFromNow(-2, 12) })
    await makeTask(ctx.db, user.id, { title: 'Nine days late', dueDate: utcDaysFromNow(-9, 12) })

    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.overdueTasks.map((task) => task.title)).toEqual(['Nine days late', 'Two days late'])
  })

  it('hydrates project and tags on the dashboard lists', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Hydrated' })
    await makeTask(ctx.db, user.id, { title: 'With relations', projectId: project.id, tags: ['alpha'] })

    const stats = await getDashboardStats(ctx.db, user.id, AT)
    expect(stats.recentTasks[0]?.project?.name).toBe('Hydrated')
    expect(stats.recentTasks[0]?.tags.map((tag) => tag.name)).toEqual(['alpha'])
  })
})

describe('activity trend', () => {
  it('returns one bucket per day for the last fortnight', async () => {
    const stats = await getDashboardStats(ctx.db, user.id, AT)

    expect(stats.trend).toHaveLength(14)
    expect(stats.trend.at(-1)?.date).toBe(
      new Date(NOW).toISOString().slice(0, 10),
    )
    expect(stats.trend.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))).toBe(true)
  })

  it('counts today\'s creations and completions in today\'s bucket', async () => {
    const task = await makeTask(ctx.db, user.id)
    await setTaskCompletion(ctx.db, user.id, task.id, true)

    const stats = await getDashboardStats(ctx.db, user.id, AT)
    const today = stats.trend.at(-1)!

    expect(today.created).toBe(1)
    expect(today.completed).toBe(1)
  })
})
