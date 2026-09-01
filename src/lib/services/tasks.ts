import { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm'

import type { Database } from '@/db'
import { projects, tags, taskTags, tasks } from '@/db/schema'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type DueFilter, type SortDirection, type SortField } from '@/lib/constants'
import {
  addDaysInZone,
  endOfDayInZone,
  startOfDayInZone,
  startOfWeekInZone,
} from '@/lib/date'
import { NotFoundError, ValidationError } from '@/lib/errors'
import type { Paginated, TagDTO, TaskDTO } from '@/types'
import type { CreateTaskInput, TaskQueryInput, UpdateTaskInput } from '@/lib/validation'

/**
 * Task reads and writes.
 *
 * Every query in this module is scoped by `userId` in its WHERE clause. That is
 * the single authorisation boundary for task data: a caller cannot reach
 * another user's row even by guessing its id, because ownership is part of the
 * predicate rather than a check performed afterwards.
 */

/**
 * Any subset of the parsed query. The route handler passes the full Zod output;
 * callers such as the dashboard pass only the couple of fields they care about.
 */
export type TaskListFilters = Partial<TaskQueryInput>

export type TaskContext = {
  timeZone: string
  now?: Date
  weekStartsOn?: number
}

/* -------------------------------------------------------------------------- */
/*                                Serialisation                               */
/* -------------------------------------------------------------------------- */

export type TaskJoinRow = {
  id: string
  title: string
  description: string | null
  status: TaskDTO['status']
  priority: TaskDTO['priority']
  dueDate: Date | null
  reminderAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  projectId: string | null
  projectName: string | null
  projectColor: string | null
}

export function serializeTask(row: TaskJoinRow, tagsForTask: TagDTO[]): TaskDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString() ?? null,
    reminderAt: row.reminderAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project:
      row.projectId && row.projectName
        ? { id: row.projectId, name: row.projectName, color: row.projectColor ?? '#6366f1' }
        : null,
    tags: tagsForTask,
  }
}

export const taskSelection = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  reminderAt: tasks.reminderAt,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  projectId: tasks.projectId,
  projectName: projects.name,
  projectColor: projects.color,
}

/** One extra query hydrates tags for a whole page, rather than one per task. */
export async function loadTagsForTasks(db: Database, taskIds: string[]): Promise<Map<string, TagDTO[]>> {
  const map = new Map<string, TagDTO[]>()
  if (taskIds.length === 0) return map

  const rows = await db
    .select({
      taskId: taskTags.taskId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, taskIds))
    .orderBy(asc(tags.name))

  for (const row of rows) {
    const list = map.get(row.taskId) ?? []
    list.push({ id: row.id, name: row.name, color: row.color })
    map.set(row.taskId, list)
  }
  return map
}

/* -------------------------------------------------------------------------- */
/*                             Filtering / sorting                            */
/* -------------------------------------------------------------------------- */

/** Escapes LIKE wildcards so a literal `%` in a search box stays literal. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

function dueDateCondition(due: DueFilter, context: Required<TaskContext>): SQL | undefined {
  const { now, timeZone, weekStartsOn } = context

  switch (due) {
    case 'overdue':
      return and(isNotNull(tasks.dueDate), lt(tasks.dueDate, now), ne(tasks.status, 'COMPLETED'))
    case 'today': {
      return and(gte(tasks.dueDate, startOfDayInZone(now, timeZone)), lte(tasks.dueDate, endOfDayInZone(now, timeZone)))
    }
    case 'tomorrow': {
      const tomorrow = addDaysInZone(now, 1, timeZone)
      return and(
        gte(tasks.dueDate, startOfDayInZone(tomorrow, timeZone)),
        lte(tasks.dueDate, endOfDayInZone(tomorrow, timeZone)),
      )
    }
    case 'week': {
      const start = startOfWeekInZone(now, timeZone, weekStartsOn)
      const end = endOfDayInZone(addDaysInZone(start, 6, timeZone), timeZone)
      return and(gte(tasks.dueDate, start), lte(tasks.dueDate, end))
    }
    case 'month': {
      const start = startOfDayInZone(now, timeZone)
      const end = endOfDayInZone(addDaysInZone(now, 30, timeZone), timeZone)
      return and(gte(tasks.dueDate, start), lte(tasks.dueDate, end))
    }
    case 'none':
      return isNull(tasks.dueDate)
    case 'any':
    default:
      return undefined
  }
}

function buildFilters(
  db: Database,
  userId: string,
  query: TaskListFilters,
  context: Required<TaskContext>,
): SQL {
  const conditions: (SQL | undefined)[] = [eq(tasks.userId, userId)]

  if (query.search) {
    const pattern = likePattern(query.search)
    conditions.push(
      or(
        ilike(tasks.title, pattern),
        ilike(tasks.description, pattern),
        ilike(projects.name, pattern),
        exists(
          db
            .select({ present: sql<number>`1` })
            .from(taskTags)
            .innerJoin(tags, eq(tags.id, taskTags.tagId))
            .where(and(eq(taskTags.taskId, tasks.id), ilike(tags.name, pattern))),
        ),
      ),
    )
  }

  if (query.status?.length) conditions.push(inArray(tasks.status, query.status))
  if (query.priority?.length) conditions.push(inArray(tasks.priority, query.priority))

  if (query.projectId === 'none') {
    conditions.push(isNull(tasks.projectId))
  } else if (query.projectId) {
    conditions.push(eq(tasks.projectId, query.projectId))
  }

  if (query.tagIds?.length) {
    conditions.push(
      exists(
        db
          .select({ present: sql<number>`1` })
          .from(taskTags)
          .where(and(eq(taskTags.taskId, tasks.id), inArray(taskTags.tagId, query.tagIds))),
      ),
    )
  }

  if (query.due) {
    const dueCondition = dueDateCondition(query.due, context)
    if (dueCondition) conditions.push(dueCondition)
  }

  return and(...conditions.filter(Boolean)) as SQL
}

function buildOrderBy(sort: SortField, direction: SortDirection): SQL[] {
  const ascending = direction === 'asc'

  switch (sort) {
    case 'dueDate':
      // Undated tasks always sink to the bottom, in both directions.
      return [
        ascending
          ? sql`${tasks.dueDate} asc nulls last`
          : sql`${tasks.dueDate} desc nulls last`,
        sql`${tasks.createdAt} desc`,
      ]
    case 'priority':
      // The enum is declared LOW -> URGENT, so descending puts URGENT first.
      return [ascending ? asc(tasks.priority) : desc(tasks.priority), sql`${tasks.createdAt} desc`]
    case 'title':
      return [ascending ? sql`lower(${tasks.title}) asc` : sql`lower(${tasks.title}) desc`, sql`${tasks.createdAt} desc`]
    case 'status':
      return [ascending ? asc(tasks.status) : desc(tasks.status), sql`${tasks.createdAt} desc`]
    case 'updatedAt':
      return [ascending ? asc(tasks.updatedAt) : desc(tasks.updatedAt)]
    case 'createdAt':
    default:
      return [ascending ? asc(tasks.createdAt) : desc(tasks.createdAt)]
  }
}

function withDefaults(context: TaskContext): Required<TaskContext> {
  return {
    timeZone: context.timeZone,
    now: context.now ?? new Date(),
    weekStartsOn: context.weekStartsOn ?? 1,
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Reads                                   */
/* -------------------------------------------------------------------------- */

export async function listTasks(
  db: Database,
  userId: string,
  query: TaskListFilters,
  context: TaskContext,
): Promise<Paginated<TaskDTO>> {
  const resolved = withDefaults(context)
  const page = query.page ?? 1
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const where = buildFilters(db, userId, query, resolved)
  const orderBy = buildOrderBy((query.sort as SortField) ?? 'createdAt', query.direction ?? 'desc')

  const [rows, totals] = await Promise.all([
    db
      .select(taskSelection)
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(where)
      // A deterministic tiebreak keeps pagination stable when sort keys tie.
      .orderBy(...orderBy, asc(tasks.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(where),
  ])

  const total = totals[0]?.value ?? 0
  const tagMap = await loadTagsForTasks(db, rows.map((row) => row.id))

  return {
    items: rows.map((row) => serializeTask(row, tagMap.get(row.id) ?? [])),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getTaskById(db: Database, userId: string, taskId: string): Promise<TaskDTO> {
  const rows = await db
    .select(taskSelection)
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) throw new NotFoundError('That task does not exist.')

  const tagMap = await loadTagsForTasks(db, [row.id])
  return serializeTask(row, tagMap.get(row.id) ?? [])
}

/** Tasks with a due date inside the window. Powers the calendar month grid. */
export async function listTasksInRange(
  db: Database,
  userId: string,
  from: Date,
  to: Date,
): Promise<TaskDTO[]> {
  const rows = await db
    .select(taskSelection)
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.userId, userId), gte(tasks.dueDate, from), lte(tasks.dueDate, to)))
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
    .limit(500)

  const tagMap = await loadTagsForTasks(db, rows.map((row) => row.id))
  return rows.map((row) => serializeTask(row, tagMap.get(row.id) ?? []))
}

/* -------------------------------------------------------------------------- */
/*                                   Writes                                   */
/* -------------------------------------------------------------------------- */

async function assertProjectOwned(db: Database, userId: string, projectId: string | null) {
  if (!projectId) return
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (rows.length === 0) {
    // Reported as a validation failure rather than a 404 so that probing for
    // another user's project id is indistinguishable from a typo.
    throw new ValidationError('Choose one of your own projects.', { projectId: 'Unknown project.' })
  }
}

/**
 * Resolves tag names to this user's tag rows, creating any that are new, then
 * replaces the task's tag links. Matching is case-insensitive, so "Work" and
 * "work" stay a single tag.
 */
async function syncTaskTags(db: Database, userId: string, taskId: string, names: string[]): Promise<void> {
  const unique = new Map<string, string>()
  for (const raw of names) {
    const name = raw.trim()
    if (name.length === 0) continue
    const key = name.toLowerCase()
    if (!unique.has(key)) unique.set(key, name)
  }

  await db.delete(taskTags).where(eq(taskTags.taskId, taskId))
  if (unique.size === 0) return

  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, [...unique.keys()])))

  const byKey = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag.id]))

  const missing = [...unique.entries()].filter(([key]) => !byKey.has(key))
  if (missing.length > 0) {
    const created = await db
      .insert(tags)
      .values(missing.map(([, name]) => ({ userId, name })))
      .onConflictDoNothing()
      .returning({ id: tags.id, name: tags.name })

    for (const tag of created) byKey.set(tag.name.toLowerCase(), tag.id)

    // A concurrent insert may have won the race; re-read anything still missing.
    const stillMissing = missing.filter(([key]) => !byKey.has(key)).map(([key]) => key)
    if (stillMissing.length > 0) {
      const refetched = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, stillMissing)))
      for (const tag of refetched) byKey.set(tag.name.toLowerCase(), tag.id)
    }
  }

  const links = [...unique.keys()]
    .map((key) => byKey.get(key))
    .filter((id): id is string => Boolean(id))
    .map((tagId) => ({ taskId, tagId }))

  if (links.length > 0) await db.insert(taskTags).values(links).onConflictDoNothing()
}

export async function createTask(
  db: Database,
  userId: string,
  input: CreateTaskInput,
): Promise<TaskDTO> {
  await assertProjectOwned(db, userId, input.projectId)

  const now = new Date()
  const inserted = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      projectId: input.projectId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      completedAt: input.status === 'COMPLETED' ? now : null,
    })
    .returning({ id: tasks.id })

  const taskId = inserted[0]?.id
  if (!taskId) throw new Error('Failed to create task')

  if (input.tags.length > 0) await syncTaskTags(db, userId, taskId, input.tags)

  return getTaskById(db, userId, taskId)
}

export async function updateTask(
  db: Database,
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskDTO> {
  const existing = await db
    .select({ id: tasks.id, status: tasks.status, completedAt: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1)

  const current = existing[0]
  if (!current) throw new NotFoundError('That task does not exist.')

  if (input.projectId !== undefined) await assertProjectOwned(db, userId, input.projectId)

  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.projectId !== undefined) patch.projectId = input.projectId
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null
  if (input.reminderAt !== undefined) patch.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null

  if (input.status !== undefined) {
    patch.status = input.status
    // completedAt is derived from status, never set directly by the client.
    if (input.status === 'COMPLETED' && current.status !== 'COMPLETED') {
      patch.completedAt = new Date()
    } else if (input.status !== 'COMPLETED') {
      patch.completedAt = null
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.update(tasks).set(patch).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
  }

  if (input.tags !== undefined) await syncTaskTags(db, userId, taskId, input.tags)

  return getTaskById(db, userId, taskId)
}

export async function setTaskCompletion(
  db: Database,
  userId: string,
  taskId: string,
  completed: boolean,
): Promise<TaskDTO> {
  const updated = await db
    .update(tasks)
    .set(
      completed
        ? { status: 'COMPLETED', completedAt: new Date() }
        : { status: 'TODO', completedAt: null },
    )
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id })

  if (updated.length === 0) throw new NotFoundError('That task does not exist.')
  return getTaskById(db, userId, taskId)
}

export async function deleteTask(db: Database, userId: string, taskId: string): Promise<void> {
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id })

  if (deleted.length === 0) throw new NotFoundError('That task does not exist.')
}
