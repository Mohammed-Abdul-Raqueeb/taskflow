import { getDb } from '@/db'
import { jsonOk, readJson, route } from '@/lib/api/http'
import { setSessionCookie } from '@/lib/auth/current-user'
import { createSession } from '@/lib/auth/session'
import { checkRateLimit, clientKey } from '@/lib/rate-limit'
import { authenticateUser } from '@/lib/services/users'
import { parseOrThrow, signInSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export const POST = route(async (request) => {
  // Slows down credential stuffing against a single instance. See src/lib/rate-limit.ts.
  checkRateLimit(clientKey(request, 'login'), { limit: 20, windowMs: 5 * 60 * 1000 })

  const input = parseOrThrow(signInSchema, await readJson(request))
  const db = await getDb()

  const user = await authenticateUser(db, input)
  const { token, expiresAt } = await createSession(db, user.id)
  await setSessionCookie(token, expiresAt)

  return jsonOk({ user })
})
