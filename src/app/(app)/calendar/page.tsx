import type { Metadata } from 'next'

import { CalendarView } from '@/components/calendar/calendar-view'
import { getDb } from '@/db'
import { getViewerTimeZone, requireUserOrRedirect } from '@/lib/auth/current-user'
import { addDaysInZone, endOfMonthInZone, startOfMonthInZone } from '@/lib/date'
import { listTasksInRange } from '@/lib/services/tasks'
import { getSettings } from '@/lib/services/users'

export const metadata: Metadata = { title: 'Calendar' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CalendarPage() {
  const user = await requireUserOrRedirect('/calendar')
  const db = await getDb()

  const [timeZone, settings] = await Promise.all([getViewerTimeZone(), getSettings(db, user.id)])

  // The visible grid spills into the neighbouring months, so pad the query by a
  // week either side. The client refetches when the month changes.
  const now = new Date()
  const from = addDaysInZone(startOfMonthInZone(now, timeZone), -7, timeZone)
  const to = addDaysInZone(endOfMonthInZone(now, timeZone), 7, timeZone)

  const tasks = await listTasksInRange(db, user.id, from, to)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Calendar</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">
          Every task with a due date, on the day it is due.
        </p>
      </div>

      <CalendarView
        initialTasks={tasks}
        timeZone={timeZone}
        weekStartsOn={settings.weekStartsOn}
      />
    </div>
  )
}
