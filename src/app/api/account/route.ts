import { getDb } from '@/db'
import { jsonOk, noContent, readJson, route } from '@/lib/api/http'
import { clearSessionCookie, requireUser } from '@/lib/auth/current-user'
import { deleteAccount, updateProfile } from '@/lib/services/users'
import { parseOrThrow, updateProfileSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = route(async (request) => {
  const current = await requireUser()
  const db = await getDb()
  const input = parseOrThrow(updateProfileSchema, await readJson(request))
  return jsonOk({ user: await updateProfile(db, current.id, input) })
})

export const DELETE = route(async () => {
  const current = await requireUser()
  const db = await getDb()
  // Tasks, projects, tags, settings and sessions all cascade from users.id.
  await deleteAccount(db, current.id)
  await clearSessionCookie()
  return noContent()
})
