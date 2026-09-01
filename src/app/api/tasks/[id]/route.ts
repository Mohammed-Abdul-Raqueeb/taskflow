import { getDb } from '@/db'
import { jsonOk, noContent, readJson, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { deleteTask, getTaskById, updateTask } from '@/lib/services/tasks'
import { parseOrThrow, updateTaskSchema } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function readId(context: Context): Promise<string> {
  const { id } = await context.params
  // Reject junk before it reaches the database, where an invalid uuid literal
  // would surface as a driver error rather than a clean 422.
  if (!UUID_PATTERN.test(id)) throw new ValidationError('That is not a valid task id.')
  return id
}

export const GET = route(async (_request, context: Context) => {
  const user = await requireUser()
  const db = await getDb()
  const task = await getTaskById(db, user.id, await readId(context))
  return jsonOk({ task })
})

export const PATCH = route(async (request, context: Context) => {
  const user = await requireUser()
  const db = await getDb()

  const input = parseOrThrow(updateTaskSchema, await readJson(request))
  const task = await updateTask(db, user.id, await readId(context), input)

  return jsonOk({ task })
})

export const DELETE = route(async (_request, context: Context) => {
  const user = await requireUser()
  const db = await getDb()
  await deleteTask(db, user.id, await readId(context))
  return noContent()
})
