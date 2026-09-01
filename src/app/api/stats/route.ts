import { getDb } from '@/db'
import { jsonOk, route } from '@/lib/api/http'
import { getViewerTimeZone, requireUser } from '@/lib/auth/current-user'
import { getDashboardStats } from '@/lib/services/stats'
import { getSettings } from '@/lib/services/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const user = await requireUser()
  const db = await getDb()
  const [timeZone, settings] = await Promise.all([getViewerTimeZone(), getSettings(db, user.id)])
  const stats = await getDashboardStats(db, user.id, { timeZone, weekStartsOn: settings.weekStartsOn })
  return jsonOk({ stats })
})
