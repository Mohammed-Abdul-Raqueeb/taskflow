import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { deleteProject, getProjectById, listProjects, updateProject } from '@/lib/services/projects'
import { deleteTag, listTags, updateTag } from '@/lib/services/tags'
import {
  deleteTask,
  getTaskById,
  listTasks,
  listTasksInRange,
  setTaskCompletion,
  updateTask,
} from '@/lib/services/tasks'
import { getDashboardStats } from '@/lib/services/stats'
import { getSettings, updateSettings } from '@/lib/services/users'
import { createTestDatabase, type TestDatabase } from './helpers/db'
import { UTC, makeProject, makeTask, makeUser, utcDaysFromNow } from './helpers/factories'
import type { ProjectDTO, TaskDTO, UserDTO } from '@/types'

/**
 * Ownership is enforced in the WHERE clause of every query, so "another user's
 * row" and "a row that does not exist" are indistinguishable to the caller.
 * These tests assert that from the outside: Mallory always gets a 404-shaped
 * failure, never Alice's data.
 */

let ctx: TestDatabase
let alice: UserDTO
let mallory: UserDTO
let aliceProject: ProjectDTO
let aliceTask: TaskDTO

const AT = { timeZone: UTC, now: new Date(utcDaysFromNow(0, 9)) }

beforeAll(async () => {
  ctx = await createTestDatabase()
})
afterAll(async () => {
  await ctx.close()
})

beforeEach(async () => {
  await ctx.reset()
  alice = await makeUser(ctx.db, { name: 'Alice', email: 'alice@example.com' })
  mallory = await makeUser(ctx.db, { name: 'Mallory', email: 'mallory@example.com' })

  aliceProject = await makeProject(ctx.db, alice.id, { name: 'Alice confidential' })
  aliceTask = await makeTask(ctx.db, alice.id, {
    title: 'Alice private task',
    description: 'Nobody else should read this.',
    projectId: aliceProject.id,
    dueDate: utcDaysFromNow(1, 12),
    tags: ['secret'],
  })
})

describe('task isolation', () => {
  it('does not include another user\'s tasks in a listing', async () => {
    await makeTask(ctx.db, mallory.id, { title: 'Mallory own task' })

    const listing = await listTasks(ctx.db, mallory.id, { pageSize: 100 }, AT)

    expect(listing.total).toBe(1)
    expect(listing.items.map((task) => task.title)).toEqual(['Mallory own task'])
  })

  it('does not leak another user\'s tasks through search', async () => {
    const listing = await listTasks(ctx.db, mallory.id, { search: 'private' }, AT)
    expect(listing.items).toEqual([])
    expect(listing.total).toBe(0)
  })

  it('refuses to read another user\'s task by id', async () => {
    await expect(getTaskById(ctx.db, mallory.id, aliceTask.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses to update another user\'s task, and leaves it untouched', async () => {
    await expect(
      updateTask(ctx.db, mallory.id, aliceTask.id, { title: 'Owned by Mallory now' }),
    ).rejects.toBeInstanceOf(NotFoundError)

    const stillAlices = await getTaskById(ctx.db, alice.id, aliceTask.id)
    expect(stillAlices.title).toBe('Alice private task')
  })

  it('refuses to complete another user\'s task', async () => {
    await expect(
      setTaskCompletion(ctx.db, mallory.id, aliceTask.id, true),
    ).rejects.toBeInstanceOf(NotFoundError)

    const stillOpen = await getTaskById(ctx.db, alice.id, aliceTask.id)
    expect(stillOpen.status).toBe('TODO')
  })

  it('refuses to delete another user\'s task, and leaves it in place', async () => {
    await expect(deleteTask(ctx.db, mallory.id, aliceTask.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(getTaskById(ctx.db, alice.id, aliceTask.id)).resolves.toMatchObject({ id: aliceTask.id })
  })

  it('excludes another user\'s tasks from a calendar range', async () => {
    const from = new Date(utcDaysFromNow(-30, 0))
    const to = new Date(utcDaysFromNow(30, 23))

    const mine = await listTasksInRange(ctx.db, mallory.id, from, to)
    expect(mine).toEqual([])

    const hers = await listTasksInRange(ctx.db, alice.id, from, to)
    expect(hers.map((task) => task.id)).toContain(aliceTask.id)
  })

  it('will not attach another user\'s project to a task', async () => {
    await expect(
      makeTask(ctx.db, mallory.id, { projectId: aliceProject.id }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('will not move an owned task into another user\'s project', async () => {
    const mine = await makeTask(ctx.db, mallory.id)

    await expect(
      updateTask(ctx.db, mallory.id, mine.id, { projectId: aliceProject.id }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('project isolation', () => {
  it('lists only the caller\'s projects', async () => {
    await makeProject(ctx.db, mallory.id, { name: 'Mallory project' })

    const projects = await listProjects(ctx.db, mallory.id)
    expect(projects.map((project) => project.name)).toEqual(['Mallory project'])
  })

  it('refuses to read, update or delete another user\'s project', async () => {
    await expect(getProjectById(ctx.db, mallory.id, aliceProject.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      updateProject(ctx.db, mallory.id, aliceProject.id, { name: 'Taken' }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(deleteProject(ctx.db, mallory.id, aliceProject.id)).rejects.toBeInstanceOf(NotFoundError)

    await expect(getProjectById(ctx.db, alice.id, aliceProject.id)).resolves.toMatchObject({
      name: 'Alice confidential',
    })
  })

  it('lets two users hold projects with the same name', async () => {
    await expect(makeProject(ctx.db, mallory.id, { name: 'Alice confidential' })).resolves.toMatchObject({
      name: 'Alice confidential',
    })
  })
})

describe('tag isolation', () => {
  it('lists only the caller\'s tags', async () => {
    await makeTask(ctx.db, mallory.id, { tags: ['mallory-tag'] })

    const mine = await listTags(ctx.db, mallory.id)
    expect(mine.map((tag) => tag.name)).toEqual(['mallory-tag'])

    const hers = await listTags(ctx.db, alice.id)
    expect(hers.map((tag) => tag.name)).toEqual(['secret'])
  })

  it('refuses to rename or delete another user\'s tag', async () => {
    const [aliceTag] = await listTags(ctx.db, alice.id)

    await expect(updateTag(ctx.db, mallory.id, aliceTag!.id, { name: 'stolen' })).rejects.toBeInstanceOf(
      NotFoundError,
    )
    await expect(deleteTag(ctx.db, mallory.id, aliceTag!.id)).rejects.toBeInstanceOf(NotFoundError)

    expect((await listTags(ctx.db, alice.id))[0]?.name).toBe('secret')
  })

  it('does not let one user filter by another user\'s tag id', async () => {
    const [aliceTag] = await listTags(ctx.db, alice.id)

    const listing = await listTasks(ctx.db, mallory.id, { tagIds: [aliceTag!.id] }, AT)
    expect(listing.items).toEqual([])
  })
})

describe('dashboard and settings isolation', () => {
  it('computes statistics only from the caller\'s own tasks', async () => {
    await makeTask(ctx.db, mallory.id, { title: 'Mallory only', status: 'COMPLETED' })

    const stats = await getDashboardStats(ctx.db, mallory.id, AT)
    expect(stats.total).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.recentTasks.map((task) => task.title)).toEqual(['Mallory only'])

    const aliceStats = await getDashboardStats(ctx.db, alice.id, AT)
    expect(aliceStats.total).toBe(1)
    expect(aliceStats.recentTasks.map((task) => task.title)).toEqual(['Alice private task'])
  })

  it('keeps settings per account', async () => {
    await updateSettings(ctx.db, alice.id, { theme: 'dark', weekStartsOn: 0 })

    expect(await getSettings(ctx.db, alice.id)).toMatchObject({ theme: 'dark', weekStartsOn: 0 })
    expect(await getSettings(ctx.db, mallory.id)).toMatchObject({ theme: 'system', weekStartsOn: 1 })
  })
})
