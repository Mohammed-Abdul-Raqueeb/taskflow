import { and, asc, count, eq, ne, sql } from 'drizzle-orm'

import type { Database } from '@/db'
import { projects, tasks } from '@/db/schema'
import { ConflictError, NotFoundError } from '@/lib/errors'
import type { ProjectDTO } from '@/types'
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/validation'

/** Every statement here is scoped by `userId`, which is the ownership boundary. */

type ProjectAggregateRow = {
  id: string
  name: string
  description: string | null
  color: string
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  taskCount: number
  completedCount: number
}

function serializeProject(row: ProjectAggregateRow): ProjectDTO {
  const taskCount = Number(row.taskCount) || 0
  const completedCount = Number(row.completedCount) || 0
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    taskCount,
    completedCount,
    progress: taskCount === 0 ? 0 : Math.round((completedCount / taskCount) * 100),
  }
}

/**
 * Lists projects together with their task totals in a single grouped query,
 * rather than one count per project.
 */
export async function listProjects(
  db: Database,
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ProjectDTO[]> {
  const conditions = [eq(projects.userId, userId)]
  if (!options.includeArchived) conditions.push(eq(projects.isArchived, false))

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      isArchived: projects.isArchived,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`count(${tasks.id})`.mapWith(Number),
      completedCount: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'COMPLETED')`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(and(...conditions))
    .groupBy(projects.id)
    .orderBy(asc(sql`lower(${projects.name})`))

  return rows.map(serializeProject)
}

export async function getProjectById(db: Database, userId: string, projectId: string): Promise<ProjectDTO> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      isArchived: projects.isArchived,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`count(${tasks.id})`.mapWith(Number),
      completedCount: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'COMPLETED')`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .groupBy(projects.id)
    .limit(1)

  const row = rows[0]
  if (!row) throw new NotFoundError('That project does not exist.')
  return serializeProject(row)
}

async function assertNameAvailable(db: Database, userId: string, name: string, excludeId?: string) {
  const conditions = [eq(projects.userId, userId), eq(sql`lower(${projects.name})`, name.toLowerCase())]
  if (excludeId) conditions.push(ne(projects.id, excludeId))

  const clash = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(...conditions))
    .limit(1)

  if (clash.length > 0) {
    throw new ConflictError('You already have a project with that name.', {
      name: 'You already have a project with that name.',
    })
  }
}

export async function createProject(
  db: Database,
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectDTO> {
  await assertNameAvailable(db, userId, input.name)

  const inserted = await db
    .insert(projects)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      color: input.color,
    })
    .returning({ id: projects.id })

  const id = inserted[0]?.id
  if (!id) throw new Error('Failed to create project')
  return getProjectById(db, userId, id)
}

export async function updateProject(
  db: Database,
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDTO> {
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (owned.length === 0) throw new NotFoundError('That project does not exist.')

  if (input.name !== undefined) await assertNameAvailable(db, userId, input.name, projectId)

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.color !== undefined) patch.color = input.color
  if (input.isArchived !== undefined) patch.isArchived = input.isArchived

  if (Object.keys(patch).length > 0) {
    await db.update(projects).set(patch).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  }

  return getProjectById(db, userId, projectId)
}

/**
 * Deleting a project keeps its tasks: the FK is `ON DELETE SET NULL`, so they
 * become unassigned rather than disappearing with the project.
 */
export async function deleteProject(db: Database, userId: string, projectId: string): Promise<void> {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id })

  if (deleted.length === 0) throw new NotFoundError('That project does not exist.')
}

export async function countProjects(db: Database, userId: string): Promise<number> {
  const rows = await db.select({ value: count() }).from(projects).where(eq(projects.userId, userId))
  return rows[0]?.value ?? 0
}
