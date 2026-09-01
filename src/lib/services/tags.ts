import { and, asc, eq, ne, sql } from 'drizzle-orm'

import type { Database } from '@/db'
import { tags, taskTags } from '@/db/schema'
import { ConflictError, NotFoundError } from '@/lib/errors'
import type { TagDTO } from '@/types'

/** Every statement here is scoped by `userId`, which is the ownership boundary. */

export async function listTags(db: Database, userId: string): Promise<TagDTO[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      taskCount: sql<number>`count(${taskTags.taskId})`.mapWith(Number),
    })
    .from(tags)
    .leftJoin(taskTags, eq(taskTags.tagId, tags.id))
    .where(eq(tags.userId, userId))
    .groupBy(tags.id)
    .orderBy(asc(sql`lower(${tags.name})`))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    taskCount: Number(row.taskCount) || 0,
  }))
}

async function assertNameAvailable(db: Database, userId: string, name: string, excludeId?: string) {
  const conditions = [eq(tags.userId, userId), eq(sql`lower(${tags.name})`, name.toLowerCase())]
  if (excludeId) conditions.push(ne(tags.id, excludeId))

  const clash = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(...conditions))
    .limit(1)

  if (clash.length > 0) {
    throw new ConflictError('You already have a tag with that name.', {
      name: 'You already have a tag with that name.',
    })
  }
}

export async function createTag(
  db: Database,
  userId: string,
  input: { name: string; color: string },
): Promise<TagDTO> {
  await assertNameAvailable(db, userId, input.name)

  const inserted = await db
    .insert(tags)
    .values({ userId, name: input.name, color: input.color })
    .returning({ id: tags.id, name: tags.name, color: tags.color })

  const row = inserted[0]
  if (!row) throw new Error('Failed to create tag')
  return { ...row, taskCount: 0 }
}

export async function updateTag(
  db: Database,
  userId: string,
  tagId: string,
  input: { name?: string; color?: string },
): Promise<TagDTO> {
  if (input.name !== undefined) await assertNameAvailable(db, userId, input.name, tagId)

  const updated = await db
    .update(tags)
    .set(input)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .returning({ id: tags.id, name: tags.name, color: tags.color })

  const row = updated[0]
  if (!row) throw new NotFoundError('That tag does not exist.')

  const counts = await db
    .select({ value: sql<number>`count(*)`.mapWith(Number) })
    .from(taskTags)
    .where(eq(taskTags.tagId, tagId))

  return { ...row, taskCount: counts[0]?.value ?? 0 }
}

/** Removing a tag also removes its links, via `ON DELETE CASCADE` on task_tags. */
export async function deleteTag(db: Database, userId: string, tagId: string): Promise<void> {
  const deleted = await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .returning({ id: tags.id })

  if (deleted.length === 0) throw new NotFoundError('That tag does not exist.')
}
