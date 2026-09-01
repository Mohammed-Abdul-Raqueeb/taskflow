import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { tags as tagsTable, taskTags, tasks } from '@/db/schema'
import { NotFoundError, ValidationError } from '@/lib/errors'
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  setTaskCompletion,
  updateTask,
} from '@/lib/services/tasks'
import { createTestDatabase, type TestDatabase } from './helpers/db'
import { UTC, daysFromNow, makeProject, makeTask, makeUser } from './helpers/factories'
import type { UserDTO } from '@/types'

let ctx: TestDatabase
let user: UserDTO

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

describe('creating a task', () => {
  it('persists every field it was given', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Launch' })
    const due = daysFromNow(3)
    const reminder = daysFromNow(2)

    const task = await createTask(ctx.db, user.id, {
      title: 'Write the release notes',
      description: 'Cover the migration steps.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: due,
      reminderAt: reminder,
      projectId: project.id,
      tags: ['docs', 'release'],
    })

    expect(task).toMatchObject({
      title: 'Write the release notes',
      description: 'Cover the migration steps.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
    })
    expect(task.dueDate).toBe(new Date(due).toISOString())
    expect(task.reminderAt).toBe(new Date(reminder).toISOString())
    expect(task.project).toMatchObject({ id: project.id, name: 'Launch' })
    expect(task.tags.map((tag) => tag.name).sort()).toEqual(['docs', 'release'])
    expect(task.completedAt).toBeNull()
  })

  it('applies sensible defaults', async () => {
    const task = await makeTask(ctx.db, user.id, { title: 'Bare minimum' })

    expect(task.status).toBe('TODO')
    expect(task.priority).toBe('MEDIUM')
    expect(task.dueDate).toBeNull()
    expect(task.project).toBeNull()
    expect(task.tags).toEqual([])
  })

  it('stamps completedAt when created straight into COMPLETED', async () => {
    const task = await makeTask(ctx.db, user.id, { status: 'COMPLETED' })
    expect(task.completedAt).not.toBeNull()
  })

  it('refuses a project the user does not own', async () => {
    const stranger = await makeUser(ctx.db)
    const theirProject = await makeProject(ctx.db, stranger.id)

    await expect(
      makeTask(ctx.db, user.id, { projectId: theirProject.id }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('reading a task', () => {
  it('returns the task with its project and tags', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Ops' })
    const created = await makeTask(ctx.db, user.id, { projectId: project.id, tags: ['urgent'] })

    const fetched = await getTaskById(ctx.db, user.id, created.id)
    expect(fetched.id).toBe(created.id)
    expect(fetched.project?.name).toBe('Ops')
    expect(fetched.tags[0]?.name).toBe('urgent')
  })

  it('reports a missing task as not found', async () => {
    await expect(
      getTaskById(ctx.db, user.id, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('updating a task', () => {
  it('changes only the fields provided', async () => {
    const task = await makeTask(ctx.db, user.id, {
      title: 'Original',
      description: 'Keep me',
      priority: 'LOW',
    })

    const updated = await updateTask(ctx.db, user.id, task.id, { title: 'Renamed', priority: 'URGENT' })

    expect(updated.title).toBe('Renamed')
    expect(updated.priority).toBe('URGENT')
    expect(updated.description).toBe('Keep me')
    expect(updated.status).toBe('TODO')
  })

  it('clears a due date when explicitly set to null', async () => {
    const task = await makeTask(ctx.db, user.id, { dueDate: daysFromNow(2) })
    expect(task.dueDate).not.toBeNull()

    const cleared = await updateTask(ctx.db, user.id, task.id, { dueDate: null })
    expect(cleared.dueDate).toBeNull()
  })

  it('sets completedAt when the status becomes COMPLETED and clears it when it does not', async () => {
    const task = await makeTask(ctx.db, user.id)

    const done = await updateTask(ctx.db, user.id, task.id, { status: 'COMPLETED' })
    expect(done.completedAt).not.toBeNull()

    const reopened = await updateTask(ctx.db, user.id, task.id, { status: 'IN_PROGRESS' })
    expect(reopened.completedAt).toBeNull()
  })

  it('keeps the original completedAt when a completed task is edited', async () => {
    const task = await makeTask(ctx.db, user.id, { status: 'COMPLETED' })
    const firstStamp = task.completedAt

    const edited = await updateTask(ctx.db, user.id, task.id, { title: 'Edited', status: 'COMPLETED' })
    expect(edited.completedAt).toBe(firstStamp)
  })

  it('replaces the tag set rather than appending to it', async () => {
    const task = await makeTask(ctx.db, user.id, { tags: ['alpha', 'beta'] })
    expect(task.tags).toHaveLength(2)

    const updated = await updateTask(ctx.db, user.id, task.id, { tags: ['beta', 'gamma'] })
    expect(updated.tags.map((tag) => tag.name).sort()).toEqual(['beta', 'gamma'])

    const links = await ctx.db.select().from(taskTags).where(eq(taskTags.taskId, task.id))
    expect(links).toHaveLength(2)
  })

  it('removes every tag when given an empty list', async () => {
    const task = await makeTask(ctx.db, user.id, { tags: ['alpha'] })
    const updated = await updateTask(ctx.db, user.id, task.id, { tags: [] })
    expect(updated.tags).toEqual([])
  })

  it('treats tag names case-insensitively and reuses the existing row', async () => {
    const first = await makeTask(ctx.db, user.id, { tags: ['Design'] })
    const second = await makeTask(ctx.db, user.id, { tags: ['design'] })

    expect(first.tags[0]?.id).toBe(second.tags[0]?.id)

    const rows = await ctx.db.select().from(tagsTable).where(eq(tagsTable.userId, user.id))
    expect(rows).toHaveLength(1)
  })

  it('de-duplicates repeated tags in a single request', async () => {
    const task = await makeTask(ctx.db, user.id, { tags: ['dup', 'DUP', ' dup '] })
    expect(task.tags).toHaveLength(1)
  })

  it('can move a task to another project and back to none', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Move target' })
    const task = await makeTask(ctx.db, user.id)

    const moved = await updateTask(ctx.db, user.id, task.id, { projectId: project.id })
    expect(moved.project?.id).toBe(project.id)

    const unassigned = await updateTask(ctx.db, user.id, task.id, { projectId: null })
    expect(unassigned.project).toBeNull()
  })

  it('reports a missing task as not found', async () => {
    await expect(
      updateTask(ctx.db, user.id, '00000000-0000-4000-8000-000000000000', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('completing a task', () => {
  it('marks a task complete and back to TODO', async () => {
    const task = await makeTask(ctx.db, user.id, { status: 'IN_PROGRESS' })

    const done = await setTaskCompletion(ctx.db, user.id, task.id, true)
    expect(done.status).toBe('COMPLETED')
    expect(done.completedAt).not.toBeNull()

    const undone = await setTaskCompletion(ctx.db, user.id, task.id, false)
    expect(undone.status).toBe('TODO')
    expect(undone.completedAt).toBeNull()
  })

  it('reports a missing task as not found', async () => {
    await expect(
      setTaskCompletion(ctx.db, user.id, '00000000-0000-4000-8000-000000000000', true),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('deleting a task', () => {
  it('removes the row and its tag links', async () => {
    const task = await makeTask(ctx.db, user.id, { tags: ['temp'] })

    await deleteTask(ctx.db, user.id, task.id)

    expect(await ctx.db.select().from(tasks).where(eq(tasks.id, task.id))).toHaveLength(0)
    expect(await ctx.db.select().from(taskTags).where(eq(taskTags.taskId, task.id))).toHaveLength(0)
    // The tag itself survives; it belongs to the user, not the task.
    expect(await ctx.db.select().from(tagsTable).where(eq(tagsTable.userId, user.id))).toHaveLength(1)
  })

  it('reports a missing task as not found', async () => {
    await expect(
      deleteTask(ctx.db, user.id, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('listing tasks', () => {
  it('paginates and reports totals', async () => {
    for (let index = 0; index < 7; index += 1) {
      await makeTask(ctx.db, user.id, { title: `Task ${index}` })
    }

    const firstPage = await listTasks(ctx.db, user.id, { page: 1, pageSize: 3 }, { timeZone: UTC })
    expect(firstPage.items).toHaveLength(3)
    expect(firstPage.total).toBe(7)
    expect(firstPage.totalPages).toBe(3)

    const lastPage = await listTasks(ctx.db, user.id, { page: 3, pageSize: 3 }, { timeZone: UTC })
    expect(lastPage.items).toHaveLength(1)

    const seen = new Set([...firstPage.items, ...lastPage.items].map((task) => task.id))
    expect(seen.size).toBe(4)
  })

  it('returns an empty page rather than failing past the end', async () => {
    await makeTask(ctx.db, user.id)
    const page = await listTasks(ctx.db, user.id, { page: 9, pageSize: 10 }, { timeZone: UTC })
    expect(page.items).toEqual([])
    expect(page.total).toBe(1)
  })
})
