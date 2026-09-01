import { ArrowLeft, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProgressBar } from '@/components/dashboard/charts'
import { TaskList } from '@/components/tasks/task-list'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { getDb } from '@/db'
import { getViewerTimeZone, requireUserOrRedirect } from '@/lib/auth/current-user'
import { NotFoundError } from '@/lib/errors'
import { getProjectById } from '@/lib/services/projects'
import { listTasks } from '@/lib/services/tasks'
import { getSettings } from '@/lib/services/users'
import { pluralize } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = Promise<{ id: string }>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return { title: 'Project' }

  const user = await requireUserOrRedirect()
  const db = await getDb()

  try {
    const project = await getProjectById(db, user.id, id)
    return { title: project.name }
  } catch {
    return { title: 'Project' }
  }
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const user = await requireUserOrRedirect(`/projects/${id}`)
  if (!UUID_PATTERN.test(id)) notFound()

  const db = await getDb()

  // Scoped by user id, so someone else's project is simply "not found".
  let project
  try {
    project = await getProjectById(db, user.id, id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const [timeZone, settings] = await Promise.all([getViewerTimeZone(), getSettings(db, user.id)])
  const tasks = await listTasks(
    db,
    user.id,
    { projectId: id, sort: 'dueDate', direction: 'asc', pageSize: 100 },
    { timeZone, weekStartsOn: settings.weekStartsOn },
  )

  const remaining = project.taskCount - project.completedCount

  return (
    <div className="space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden="true"
            />
            <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {project.name}
            </h2>
            {project.isArchived ? (
              <span className="rounded bg-surface-muted px-2 py-0.5 text-[11px] text-foreground-subtle">
                Archived
              </span>
            ) : null}
          </div>
          {project.description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-muted">
              {project.description}
            </p>
          ) : null}
        </div>

        <Link href={`/tasks/new?projectId=${project.id}`}>
          <Button leadingIcon={<Plus className="size-4" />}>Add task</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="pt-5">
          <dl className="grid grid-cols-3 gap-4 text-center sm:max-w-md sm:text-left">
            <div>
              <dt className="text-xs text-foreground-subtle">Total</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{project.taskCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-subtle">Completed</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {project.completedCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-subtle">Open</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{remaining}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-foreground-muted">Progress</span>
              <span className="font-medium tabular-nums">{project.progress}%</span>
            </div>
            <ProgressBar
              value={project.progress}
              color={project.color}
              label={`${project.name}: ${project.progress}% complete`}
            />
          </div>
        </CardBody>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">
          Tasks
          <span className="ml-2 text-xs font-normal text-foreground-subtle">
            {pluralize(tasks.total, 'task')}, soonest deadline first
          </span>
        </h3>

        <TaskList
          tasks={tasks.items}
          timeZone={timeZone}
          emptyTitle="No tasks in this project"
          emptyDescription="Add the first one and it will appear here."
          emptyAction={
            <Link href={`/tasks/new?projectId=${project.id}`}>
              <Button leadingIcon={<Plus className="size-4" />}>Add task</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
