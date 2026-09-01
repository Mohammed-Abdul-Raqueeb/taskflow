import { jsonOk, route } from '@/lib/api/http'
import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const user = await getCurrentUser()
  return jsonOk({ user })
})
