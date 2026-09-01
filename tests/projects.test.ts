import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ConflictError, NotFoundError } from '@/lib/errors'
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
} from '@/lib/services/projects'
import { createTag, deleteTag, listTags, updateTag } from '@/lib/services/tags'
import { getTaskById, listTasks } from '@/lib/services/tasks'
import { createTestDatabase, type TestDatabase } from './helpers/db'
import { UTC, makeProject, makeTask, makeUser } from './helpers/factories'
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

describe('project CRUD', () => {
  it('creates a project with its defaults', async () => {
    const project = await createProject(ctx.db, user.id, {
      name: 'Website Redesign',
      description: null,
      color: '#6366f1',
    })

    expect(project).toMatchObject({
      name: 'Website Redesign',
      color: '#6366f1',
      isArchived: false,
      taskCount: 0,
      completedCount: 0,
      progress: 0,
    })
  })

  it('rejects a duplicate name for the same user, ignoring case', async () => {
    await makeProject(ctx.db, user.id, { name: 'Marketing' })

    await expect(
      createProject(ctx.db, user.id, { name: 'marketing', description: null, color: '#6366f1' }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('updates name, colour, description and archive state', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Old name' })

    const updated = await updateProject(ctx.db, user.id, project.id, {
      name: 'New name',
      color: '#10b981',
      description: 'Now with a description',
      isArchived: true,
    })

    expect(updated).toMatchObject({
      name: 'New name',
      color: '#10b981',
      description: 'Now with a description',
      isArchived: true,
    })
  })

  it('lets a project keep its own name when renamed to itself', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Same' })
    await expect(
      updateProject(ctx.db, user.id, project.id, { name: 'Same', color: '#0ea5e9' }),
    ).resolves.toMatchObject({ color: '#0ea5e9' })
  })

  it('hides archived projects from the default listing', async () => {
    const kept = await makeProject(ctx.db, user.id, { name: 'Active' })
    const archived = await makeProject(ctx.db, user.id, { name: 'Archived' })
    await updateProject(ctx.db, user.id, archived.id, { isArchived: true })

    const visible = await listProjects(ctx.db, user.id)
    expect(visible.map((project) => project.id)).toEqual([kept.id])

    const all = await listProjects(ctx.db, user.id, { includeArchived: true })
    expect(all).toHaveLength(2)
  })

  it('reports a missing project as not found', async () => {
    await expect(
      getProjectById(ctx.db, user.id, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('project progress', () => {
  it('counts tasks and completions', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Counted' })

    await makeTask(ctx.db, user.id, { projectId: project.id, status: 'COMPLETED' })
    await makeTask(ctx.db, user.id, { projectId: project.id, status: 'COMPLETED' })
    await makeTask(ctx.db, user.id, { projectId: project.id, status: 'TODO' })
    await makeTask(ctx.db, user.id, { projectId: project.id, status: 'IN_PROGRESS' })
    // Belongs to no project, so it must not be counted here.
    await makeTask(ctx.db, user.id, { status: 'COMPLETED' })

    const fetched = await getProjectById(ctx.db, user.id, project.id)
    expect(fetched.taskCount).toBe(4)
    expect(fetched.completedCount).toBe(2)
    expect(fetched.progress).toBe(50)
  })

  it('reports 0% for an empty project rather than dividing by zero', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Empty' })
    expect((await getProjectById(ctx.db, user.id, project.id)).progress).toBe(0)
  })

  it('includes projects with no tasks in the listing', async () => {
    await makeProject(ctx.db, user.id, { name: 'Lonely' })
    const projects = await listProjects(ctx.db, user.id)
    expect(projects).toHaveLength(1)
    expect(projects[0]?.taskCount).toBe(0)
  })
})

describe('deleting a project', () => {
  it('keeps its tasks and unassigns them', async () => {
    const project = await makeProject(ctx.db, user.id, { name: 'Doomed' })
    const task = await makeTask(ctx.db, user.id, { projectId: project.id, title: 'Survivor' })

    await deleteProject(ctx.db, user.id, project.id)

    const survivor = await getTaskById(ctx.db, user.id, task.id)
    expect(survivor.title).toBe('Survivor')
    expect(survivor.project).toBeNull()

    const unassigned = await listTasks(ctx.db, user.id, { projectId: 'none' }, { timeZone: UTC })
    expect(unassigned.items.map((item) => item.id)).toEqual([task.id])
  })

  it('reports a missing project as not found', async () => {
    await expect(
      deleteProject(ctx.db, user.id, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('tags', () => {
  it('creates a tag and counts how many tasks use it', async () => {
    const tag = await createTag(ctx.db, user.id, { name: 'urgent', color: '#f43f5e' })
    expect(tag.taskCount).toBe(0)

    await makeTask(ctx.db, user.id, { tags: ['urgent'] })
    await makeTask(ctx.db, user.id, { tags: ['urgent'] })
    await makeTask(ctx.db, user.id, { tags: ['other'] })

    const tags = await listTags(ctx.db, user.id)
    expect(tags.find((candidate) => candidate.name === 'urgent')?.taskCount).toBe(2)
    expect(tags.find((candidate) => candidate.name === 'other')?.taskCount).toBe(1)
  })

  it('rejects a duplicate tag name, ignoring case', async () => {
    await createTag(ctx.db, user.id, { name: 'Design', color: '#8b5cf6' })
    await expect(
      createTag(ctx.db, user.id, { name: 'design', color: '#8b5cf6' }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('renames a tag everywhere it is used', async () => {
    const task = await makeTask(ctx.db, user.id, { tags: ['old-name'] })
    const [tag] = await listTags(ctx.db, user.id)

    await updateTag(ctx.db, user.id, tag!.id, { name: 'new-name' })

    const refreshed = await getTaskById(ctx.db, user.id, task.id)
    expect(refreshed.tags.map((candidate) => candidate.name)).toEqual(['new-name'])
  })

  it('deleting a tag removes it from its tasks but keeps the tasks', async () => {
    const task = await makeTask(ctx.db, user.id, { tags: ['temporary', 'keeper'] })
    const tags = await listTags(ctx.db, user.id)
    const temporary = tags.find((candidate) => candidate.name === 'temporary')!

    await deleteTag(ctx.db, user.id, temporary.id)

    const refreshed = await getTaskById(ctx.db, user.id, task.id)
    expect(refreshed.tags.map((candidate) => candidate.name)).toEqual(['keeper'])
  })
})
