import { getDb } from '@/db'
import { jsonOk, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { ValidationError } from '@/lib/errors'
import { listTasksInRange } from '@/lib/services/tasks'
import { calendarQuerySchema, parseOrThrow, searchParamsToObject } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000

export const GET = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()

  const url = new URL(request.url)
  const { from, to } = parseOrThrow(calendarQuerySchema, searchParamsToObject(url.searchParams))

  const start = new Date(from)
  const end = new Date(to)
  if (end < start) throw new ValidationError('The end of the range must come after its start.')
  // Bounds the work a single request can ask for.
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw new ValidationError('Request at most two months of calendar data at a time.')
  }

  return jsonOk({ tasks: await listTasksInRange(db, user.id, start, end) })
})
