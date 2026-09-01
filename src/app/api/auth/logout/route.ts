import { getDb } from '@/db'
import { jsonOk, route } from '@/lib/api/http'
import { clearSessionCookie, readSessionToken } from '@/lib/auth/current-user'
import { destroySession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export const POST = route(async () => {
  const token = await readSessionToken()
  if (token) {
    const db = await getDb()
    await destroySession(db, token)
  }
  await clearSessionCookie()
  return jsonOk({ ok: true })
})
