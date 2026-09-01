import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Flame,
  ListTodo,
  Plus,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { BarBreakdown, ProgressBar, ProgressRing, TrendChart } from '@/components/dashboard/charts'
import { StatCard } from '@/components/dashboard/stat-card'
import { TaskMiniList } from '@/components/tasks/task-list'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import { getDb } from '@/db'
import { getViewerTimeZone, requireUserOrRedirect } from '@/lib/auth/current-user'
import { PRIORITY_META, STATUS_META } from '@/lib/constants'
import { getDashboardStats } from '@/lib/services/stats'
import { getSettings } from '@/lib/services/users'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUserOrRedirect('/dashboard')
  const db = await getDb()

  const [timeZone, settings] = await Promise.all([getViewerTimeZone(), getSettings(db, user.id)])
  const stats = await getDashboardStats(db, user.id, {
    timeZone,
    weekStartsOn: settings.weekStartsOn,
  })

  const firstName = user.name.split(' ')[0]

  if (stats.total === 0) {
    return (
      <div className="space-y-6">
        <Greeting name={firstName} subtitle="Let's get the first thing written down." />
        <EmptyState
          icon={ListTodo}
          title="Your dashboard is waiting on its first task"
          description="Every number here is computed from your own tasks, so it stays empty until you add one."
          action={
            <Link href="/tasks/new">
              <Button leadingIcon={<Plus className="size-4" />}>Create your first task</Button>
            </Link>
          }
          className="py-16"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Greeting
          name={firstName}
          subtitle={
            stats.dueToday > 0
              ? `${stats.dueToday} ${stats.dueToday === 1 ? 'task is' : 'tasks are'} due today.`
              : 'Nothing is due today.'
          }
        />
        <Link href="/tasks/new">
          <Button leadingIcon={<Plus className="size-4" />}>New task</Button>
        </Link>
      </div>

      {/* Each tile links to the task list with the matching filter applied. */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total tasks" value={stats.total} icon={ListTodo} href="/tasks" />
        <StatCard
          label="Completed"
          value={stats.completed}
          hint={`${stats.completionRate}% of everything`}
          icon={CheckCircle2}
          tone="success"
          href="/tasks?status=COMPLETED"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          hint={`${stats.byStatus.IN_PROGRESS} in progress`}
          icon={CalendarCheck}
          href="/tasks?status=TODO,IN_PROGRESS"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint={stats.overdue > 0 ? 'Needs attention' : 'All clear'}
          icon={AlertTriangle}
          tone={stats.overdue > 0 ? 'danger' : 'default'}
          href="/tasks?due=overdue"
        />
      </section>

      <section aria-label="This week" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Due today" value={stats.dueToday} icon={CalendarCheck} href="/tasks?due=today" />
        <StatCard
          label="Due this week"
          value={stats.dueThisWeek}
          icon={CalendarCheck}
          href="/tasks?due=week"
        />
        <StatCard
          label="High priority"
          value={stats.highPriority}
          hint="Open, high or urgent"
          icon={Flame}
          tone="warning"
          href="/tasks?priority=HIGH,URGENT&status=TODO,IN_PROGRESS"
        />
        <StatCard
          label="Completion rate"
          value={`${stats.completionRate}%`}
          hint={`${stats.completed} of ${stats.total}`}
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Activity"
            description="Tasks created and completed over the last fortnight."
          />
          <CardBody>
            <TrendChart points={stats.trend} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Progress" description="How much of your work is finished." />
          <CardBody className="flex flex-col items-center pt-2">
            <ProgressRing value={stats.completionRate} sublabel="complete" />
            <dl className="mt-5 grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-[var(--radius-app)] bg-surface-muted px-3 py-2.5">
                <dt className="text-xs text-foreground-subtle">Completed</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </dd>
              </div>
              <div className="rounded-[var(--radius-app)] bg-surface-muted px-3 py-2.5">
                <dt className="text-xs text-foreground-subtle">Remaining</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{stats.pending}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By priority" description="Where the weight of your backlog sits." />
          <CardBody>
            <BarBreakdown
              items={(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((priority) => ({
                label: PRIORITY_META[priority].label,
                value: stats.byPriority[priority],
                color: PRIORITY_META[priority].chartColor,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By status" description="How work is moving through the pipeline." />
          <CardBody>
            <BarBreakdown
              items={(['TODO', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => ({
                label: STATUS_META[status].label,
                value: stats.byStatus[status],
                color: STATUS_META[status].chartColor,
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="By project"
          description="Completed against total, for every project with tasks."
          action={
            <Link
              href="/projects"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              All projects
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <CardBody>
          {stats.byProject.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-subtle">No projects yet.</p>
          ) : (
            <ul className="space-y-4">
              {stats.byProject.map((row) => {
                const percent = row.total === 0 ? 0 : Math.round((row.completed / row.total) * 100)
                const href = row.projectId ? `/projects/${row.projectId}` : '/tasks?projectId=none'

                return (
                  <li key={row.projectId ?? 'none'}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={href} className="flex min-w-0 items-center gap-2 hover:underline">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{row.name}</span>
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-foreground-subtle">
                        {row.completed}/{row.total} · {percent}%
                      </span>
                    </div>
                    <ProgressBar
                      value={percent}
                      color={row.color}
                      className="mt-1.5"
                      label={`${row.name}: ${percent}% complete`}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Overdue" description="Oldest first." />
          <CardBody>
            <TaskMiniList
              tasks={stats.overdueTasks}
              timeZone={timeZone}
              emptyMessage="Nothing is overdue. Nice."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Upcoming" description="Next deadlines." />
          <CardBody>
            <TaskMiniList
              tasks={stats.upcomingTasks}
              timeZone={timeZone}
              emptyMessage="No scheduled work ahead."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recently added" description="The last five you created." />
          <CardBody>
            <TaskMiniList
              tasks={stats.recentTasks}
              timeZone={timeZone}
              emptyMessage="Nothing here yet."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Greeting({ name, subtitle }: { name?: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {name ? `Hello, ${name}` : 'Hello'}
      </h2>
      <p className="mt-0.5 text-sm text-foreground-muted">{subtitle}</p>
    </div>
  )
}
