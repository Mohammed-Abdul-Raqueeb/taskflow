import { getDb } from '@/db'
import { jsonCreated, jsonOk, readJson, route } from '@/lib/api/http'
import { getViewerTimeZone, requireUser } from '@/lib/auth/current-user'
import { createTask, listTasks } from '@/lib/services/tasks'
import { getSettings } from '@/lib/services/users'
import {
  createTaskSchema,
  parseOrThrow,
  searchParamsToObject,
  taskQuerySchema,
} from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()

  const url = new URL(request.url)
  const query = parseOrThrow(taskQuerySchema, searchParamsToObject(url.searchParams))
  const [timeZone, settings] = await Promise.all([getViewerTimeZone(), getSettings(db, user.id)])

  const result = await listTasks(db, user.id, query, {
    timeZone,
    weekStartsOn: settings.weekStartsOn,
  })

  return jsonOk(result)
})

export const POST = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()

  const input = parseOrThrow(createTaskSchema, await readJson(request))
  const task = await createTask(db, user.id, input)

  return jsonCreated({ task })
})
