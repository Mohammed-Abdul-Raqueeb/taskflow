import { getDb } from '@/db'
import { jsonOk, readJson, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { getSettings, updateSettings } from '@/lib/services/users'
import { parseOrThrow, updateSettingsSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const user = await requireUser()
  const db = await getDb()
  return jsonOk({ settings: await getSettings(db, user.id) })
})

export const PATCH = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()
  const input = parseOrThrow(updateSettingsSchema, await readJson(request))
  return jsonOk({ settings: await updateSettings(db, user.id, input) })
})
