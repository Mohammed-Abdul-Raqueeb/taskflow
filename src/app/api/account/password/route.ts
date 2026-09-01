import { getDb } from '@/db'
import { jsonOk, readJson, route } from '@/lib/api/http'
import { readSessionToken, requireUser } from '@/lib/auth/current-user'
import { destroyOtherSessions } from '@/lib/auth/session'
import { checkRateLimit, clientKey } from '@/lib/rate-limit'
import { changePassword } from '@/lib/services/users'
import { changePasswordSchema, parseOrThrow } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = route(async (request) => {
  const user = await requireUser()
  checkRateLimit(clientKey(request, `password:${user.id}`), { limit: 10, windowMs: 15 * 60 * 1000 })

  const input = parseOrThrow(changePasswordSchema, await readJson(request))
  const db = await getDb()
  await changePassword(db, user.id, input)

  // Sign every other device out; the device that made the change stays in.
  await destroyOtherSessions(db, user.id, await readSessionToken())

  return jsonOk({ ok: true })
})
