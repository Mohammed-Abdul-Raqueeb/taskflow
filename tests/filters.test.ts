import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { listTasks } from '@/lib/services/tasks'
import { listTags } from '@/lib/services/tags'
import { createTestDatabase, type TestDatabase } from './helpers/db'
import { UTC, makeProject, makeTask, makeUser, utcDaysFromNow } from './helpers/factories'
import type { ProjectDTO, UserDTO } from '@/types'

let ctx: TestDatabase
let user: UserDTO
let website: ProjectDTO
let mobile: ProjectDTO

const titlesOf = (items: { title: string }[]) => items.map((item) => item.title)

/** Fixed reference point: 09:00 UTC today. Fixtures are placed relative to it. */
const NOW = new Date(utcDaysFromNow(0, 9))
const AT = { timeZone: UTC, now: NOW }

beforeAll(async () => {
  ctx = await createTestDatabase()
})
afterAll(async () => {
  await ctx.close()
})

beforeEach(async () => {
  await ctx.reset()
  user = await makeUser(ctx.db)
  website = await makeProject(ctx.db, user.id, { name: 'Website Redesign' })
  mobile = await makeProject(ctx.db, user.id, { name: 'Mobile App' })

  await makeTask(ctx.db, user.id, {
    title: 'Fix the pricing page layout',
    description: 'Cumulative layout shift on load.',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    projectId: website.id,
    dueDate: utcDaysFromNow(-2, 12),
    tags: ['bug', 'frontend'],
  })
  await makeTask(ctx.db, user.id, {
    title: 'Design the empty states',
    description: 'Four screens, including the first-run tips.',
    status: 'TODO',
    priority: 'HIGH',
    projectId: mobile.id,
    dueDate: utcDaysFromNow(0, 18),
    tags: ['design'],
  })
  await makeTask(ctx.db, user.id, {
    title: 'Archive the old assets',
    status: 'COMPLETED',
    priority: 'LOW',
    projectId: website.id,
    dueDate: utcDaysFromNow(-5, 12),
    tags: ['frontend'],
  })
  await makeTask(ctx.db, user.id, {
    title: 'Research offline sync',
    description: 'Compare replay queues against CRDTs.',
    status: 'TODO',
    priority: 'MEDIUM',
    projectId: mobile.id,
    dueDate: utcDaysFromNow(6, 12),
    tags: ['research'],
  })
  await makeTask(ctx.db, user.id, {
    title: 'Someday: rewrite the onboarding',
    status: 'TODO',
    priority: 'LOW',
    tags: [],
  })
})

describe('search', () => {
  it('matches on the title', async () => {
    const result = await listTasks(ctx.db, user.id, { search: 'pricing' }, AT)
    expect(titlesOf(result.items)).toEqual(['Fix the pricing page layout'])
  })

  it('matches on the description', async () => {
    const result = await listTasks(ctx.db, user.id, { search: 'CRDT' }, AT)
    expect(titlesOf(result.items)).toEqual(['Research offline sync'])
  })

  it('matches on the project name', async () => {
    const result = await listTasks(ctx.db, user.id, { search: 'Mobile App' }, AT)
    expect(titlesOf(result.items).sort()).toEqual(['Design the empty states', 'Research offline sync'])
  })

  it('matches on a tag name', async () => {
    const result = await listTasks(ctx.db, user.id, { search: 'frontend' }, AT)
    expect(titlesOf(result.items).sort()).toEqual([
      'Archive the old assets',
      'Fix the pricing page layout',
    ])
  })

  it('is case-insensitive', async () => {
    const result = await listTasks(ctx.db, user.id, { search: 'PRICING' }, AT)
    expect(result.items).toHaveLength(1)
  })

  it('treats LIKE wildcards as literal characters', async () => {
    await makeTask(ctx.db, user.id, { title: 'Discount 50% off banner' })

    // A bare "%" would match everything if it were not escaped.
    const wildcard = await listTasks(ctx.db, user.id, { search: '%' }, AT)
    expect(titlesOf(wildcard.items)).toEqual(['Discount 50% off banner'])

    const underscore = await listTasks(ctx.db, user.id, { search: '_' }, AT)
    expect(underscore.items).toHaveLength(0)
  })

  it('reports the filtered total, not the overall total', async () => {
    const result = await listTasks(ctx.db, user.id, { search: 'pricing', pageSize: 1 }, AT)
    expect(result.total).toBe(1)
  })
})

describe('filters', () => {
  it('filters by a single status', async () => {
    const result = await listTasks(ctx.db, user.id, { status: ['COMPLETED'] }, AT)
    expect(titlesOf(result.items)).toEqual(['Archive the old assets'])
  })

  it('filters by several statuses at once', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { status: ['IN_PROGRESS', 'COMPLETED'] },
      AT,
    )
    expect(result.items).toHaveLength(2)
  })

  it('filters by priority', async () => {
    const result = await listTasks(ctx.db, user.id, { priority: ['URGENT', 'HIGH'] }, AT)
    expect(titlesOf(result.items).sort()).toEqual([
      'Design the empty states',
      'Fix the pricing page layout',
    ])
  })

  it('filters by project', async () => {
    const result = await listTasks(ctx.db, user.id, { projectId: website.id }, AT)
    expect(result.items).toHaveLength(2)
    expect(result.items.every((task) => task.project?.id === website.id)).toBe(true)
  })

  it('filters to tasks with no project', async () => {
    const result = await listTasks(ctx.db, user.id, { projectId: 'none' }, AT)
    expect(titlesOf(result.items)).toEqual(['Someday: rewrite the onboarding'])
  })

  it('filters by tag', async () => {
    const tags = await listTags(ctx.db, user.id)
    const frontend = tags.find((tag) => tag.name === 'frontend')!

    const result = await listTasks(ctx.db, user.id, { tagIds: [frontend.id] }, AT)
    expect(titlesOf(result.items).sort()).toEqual([
      'Archive the old assets',
      'Fix the pricing page layout',
    ])
  })

  it('treats several tags as "any of"', async () => {
    const tags = await listTags(ctx.db, user.id)
    const ids = tags.filter((tag) => ['design', 'research'].includes(tag.name)).map((tag) => tag.id)

    const result = await listTasks(ctx.db, user.id, { tagIds: ids }, AT)
    expect(titlesOf(result.items).sort()).toEqual(['Design the empty states', 'Research offline sync'])
  })

  it('does not return a task twice when it matches two selected tags', async () => {
    const tags = await listTags(ctx.db, user.id)
    const ids = tags.filter((tag) => ['bug', 'frontend'].includes(tag.name)).map((tag) => tag.id)

    const result = await listTasks(ctx.db, user.id, { tagIds: ids }, AT)
    const idsSeen = result.items.map((task) => task.id)
    expect(new Set(idsSeen).size).toBe(idsSeen.length)
  })

  it('finds overdue tasks and excludes completed ones', async () => {
    const result = await listTasks(ctx.db, user.id, { due: 'overdue' }, AT)
    // "Archive the old assets" is also past its due date but is already done.
    expect(titlesOf(result.items)).toEqual(['Fix the pricing page layout'])
  })

  it('finds tasks due today', async () => {
    const result = await listTasks(ctx.db, user.id, { due: 'today' }, AT)
    expect(titlesOf(result.items)).toEqual(['Design the empty states'])
  })

  it('finds tasks with no due date', async () => {
    const result = await listTasks(ctx.db, user.id, { due: 'none' }, AT)
    expect(titlesOf(result.items)).toEqual(['Someday: rewrite the onboarding'])
  })

  it('finds tasks due within the next month', async () => {
    const result = await listTasks(ctx.db, user.id, { due: 'month' }, AT)
    expect(titlesOf(result.items).sort()).toEqual(['Design the empty states', 'Research offline sync'])
  })

  it('combines filters as AND', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { status: ['TODO'], projectId: mobile.id },
      AT,
    )
    expect(titlesOf(result.items).sort()).toEqual(['Design the empty states', 'Research offline sync'])
  })

  it('combines a search with a filter', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { search: 'the', status: ['COMPLETED'] },
      AT,
    )
    expect(titlesOf(result.items)).toEqual(['Archive the old assets'])
  })
})

describe('sorting', () => {
  it('sorts by due date ascending, keeping undated tasks last', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { sort: 'dueDate', direction: 'asc' },
      AT,
    )
    expect(titlesOf(result.items)).toEqual([
      'Archive the old assets',
      'Fix the pricing page layout',
      'Design the empty states',
      'Research offline sync',
      'Someday: rewrite the onboarding',
    ])
  })

  it('keeps undated tasks last when sorting descending too', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { sort: 'dueDate', direction: 'desc' },
      AT,
    )
    expect(result.items.at(-1)?.title).toBe('Someday: rewrite the onboarding')
    expect(result.items[0]?.title).toBe('Research offline sync')
  })

  it('sorts by priority with the most urgent first', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { sort: 'priority', direction: 'desc' },
      AT,
    )
    expect(result.items.map((task) => task.priority)).toEqual([
      'URGENT',
      'HIGH',
      'MEDIUM',
      'LOW',
      'LOW',
    ])
  })

  it('sorts by title alphabetically, ignoring case', async () => {
    await makeTask(ctx.db, user.id, { title: 'apple pie' })
    await makeTask(ctx.db, user.id, { title: 'Banana bread' })

    const result = await listTasks(
      ctx.db,
      user.id,
      { sort: 'title', direction: 'asc', pageSize: 100 },
      AT,
    )
    const titles = titlesOf(result.items)
    expect(titles.indexOf('apple pie')).toBeLessThan(titles.indexOf('Banana bread'))
    expect(titles.indexOf('Archive the old assets')).toBeLessThan(titles.indexOf('Banana bread'))
  })

  it('sorts by status in workflow order', async () => {
    const result = await listTasks(
      ctx.db,
      user.id,
      { sort: 'status', direction: 'asc' },
      AT,
    )
    expect(result.items.at(0)?.status).toBe('TODO')
    expect(result.items.at(-1)?.status).toBe('COMPLETED')
  })

  it('sorts by creation date, newest first, by default', async () => {
    const result = await listTasks(ctx.db, user.id, {}, AT)
    const stamps = result.items.map((task) => new Date(task.createdAt).getTime())
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps)
  })

  it('paginates deterministically when sort keys tie', async () => {
    for (let index = 0; index < 6; index += 1) {
      await makeTask(ctx.db, user.id, { title: `Tie ${index}`, priority: 'LOW' })
    }

    const first = await listTasks(
      ctx.db,
      user.id,
      { sort: 'priority', direction: 'asc', page: 1, pageSize: 4 },
      AT,
    )
    const second = await listTasks(
      ctx.db,
      user.id,
      { sort: 'priority', direction: 'asc', page: 2, pageSize: 4 },
      AT,
    )

    const overlap = first.items.filter((task) => second.items.some((other) => other.id === task.id))
    expect(overlap).toEqual([])
  })
})
