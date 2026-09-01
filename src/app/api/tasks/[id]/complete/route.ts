import { getDb } from '@/db'
import { jsonOk, readJson, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { ValidationError } from '@/lib/errors'
import { setTaskCompletion } from '@/lib/services/tasks'
import { parseOrThrow, toggleTaskSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Dedicated endpoint for the list checkbox: one small payload, one write, and
 * no chance of a stray field riding along with a status flip.
 */
export const PATCH = route(async (request, context: Context) => {
  const user = await requireUser()
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) throw new ValidationError('That is not a valid task id.')

  const { completed } = parseOrThrow(toggleTaskSchema, await readJson(request))
  const db = await getDb()
  const task = await setTaskCompletion(db, user.id, id, completed)

  return jsonOk({ task })
})
