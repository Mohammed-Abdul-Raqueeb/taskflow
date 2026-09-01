import { getDb } from '@/db'
import { jsonCreated, readJson, route } from '@/lib/api/http'
import { setSessionCookie } from '@/lib/auth/current-user'
import { createSession } from '@/lib/auth/session'
import { checkRateLimit, clientKey } from '@/lib/rate-limit'
import { registerUser } from '@/lib/services/users'
import { parseOrThrow, signUpSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export const POST = route(async (request) => {
  checkRateLimit(clientKey(request, 'signup'), { limit: 10, windowMs: 60 * 60 * 1000 })

  const input = parseOrThrow(signUpSchema, await readJson(request))
  const db = await getDb()

  const user = await registerUser(db, input)
  const { token, expiresAt } = await createSession(db, user.id)
  await setSessionCookie(token, expiresAt)

  return jsonCreated({ user })
})
