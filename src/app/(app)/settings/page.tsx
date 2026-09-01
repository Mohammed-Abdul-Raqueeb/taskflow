import type { Metadata } from 'next'

import {
  AppearancePanel,
  DangerZonePanel,
  NotificationsPanel,
  PasswordPanel,
  ProfilePanel,
} from '@/components/settings/settings-panels'
import { TagsPanel } from '@/components/settings/tags-panel'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { getDb } from '@/db'
import { getViewerTimeZone, requireUserOrRedirect } from '@/lib/auth/current-user'
import { countProjects } from '@/lib/services/projects'
import { listTags } from '@/lib/services/tags'
import { listTasks } from '@/lib/services/tasks'
import { getSettings } from '@/lib/services/users'
import { formatDate } from '@/lib/date'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function SettingsPage() {
  const user = await requireUserOrRedirect('/settings')
  const db = await getDb()

  const [timeZone, settings, projectCount, tags] = await Promise.all([
    getViewerTimeZone(),
    getSettings(db, user.id),
    countProjects(db, user.id),
    listTags(db, user.id),
  ])

  // Only the total is needed, so ask for a single row and read the count.
  const taskTotals = await listTasks(db, user.id, { pageSize: 1 }, { timeZone })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">
          Your profile, how the app looks, and what it is allowed to send you.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <ProfilePanel user={user} />
          <PasswordPanel />
          <TagsPanel tags={tags} />
        </div>

        <div className="space-y-4">
          <AppearancePanel settings={settings} />
          <NotificationsPanel settings={settings} />

          <Card>
            <CardHeader title="Account" description="Read-only details about this account." />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-subtle">Member since</dt>
                  <dd>{formatDate(user.createdAt, timeZone)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-subtle">Time zone</dt>
                  <dd className="text-right">{timeZone}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-subtle">Tasks</dt>
                  <dd className="tabular-nums">{taskTotals.total}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-subtle">Projects</dt>
                  <dd className="tabular-nums">{projectCount}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-foreground-subtle">
                The time zone is detected from your browser and decides what counts as
                &ldquo;today&rdquo; and &ldquo;overdue&rdquo;.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <DangerZonePanel taskCount={taskTotals.total} projectCount={projectCount} />
    </div>
  )
}
