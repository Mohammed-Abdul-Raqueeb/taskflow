import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { Pagination, TaskFilters } from '@/components/tasks/task-filters'
import { TaskList } from '@/components/tasks/task-list'
import { Button } from '@/components/ui/button'
import { ErrorState, TaskListSkeleton } from '@/components/ui/states'
import { getDb } from '@/db'
import { getViewerTimeZone, requireUserOrRedirect } from '@/lib/auth/current-user'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { ValidationError } from '@/lib/errors'
import { listProjects } from '@/lib/services/projects'
import { listTags } from '@/lib/services/tags'
import { listTasks } from '@/lib/services/tasks'
import { getSettings } from '@/lib/services/users'
import { parseOrThrow, taskQuerySchema } from '@/lib/validation'

export const metadata: Metadata = { title: 'Tasks' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">All tasks</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Search, filter and sort everything you have captured.
          </p>
        </div>
        <Link href="/tasks/new">
          <Button leadingIcon={<Plus className="size-4" />}>New task</Button>
        </Link>
      </div>

      {/* The key restarts the boundary whenever the query changes, so the
          skeleton shows again for the new query rather than the stale list. */}
      <Suspense key={JSON.stringify(params)} fallback={<TasksLoading />}>
        <TaskResults params={params} />
      </Suspense>
    </div>
  )
}

function TasksLoading() {
  return (
    <div className="space-y-4">
      <div className="h-9.5 w-full max-w-md animate-pulse rounded-[var(--radius-app)] bg-surface-muted" />
      <TaskListSkeleton />
    </div>
  )
}

async function TaskResults({ params }: { params: Record<string, string | string[] | undefined> }) {
  const user = await requireUserOrRedirect('/tasks')
  const db = await getDb()

  // The URL is user input like any other, so it goes through the same schema
  // the API uses. A malformed query becomes an inline message, not a crash.
  let query
  try {
    query = parseOrThrow(taskQuerySchema, params)
  } catch (error) {
    if (error instanceof ValidationError) {
      return (
        <ErrorState
          title="That filter is not valid"
          description={error.message}
          action={
            <Link href="/tasks">
              <Button variant="secondary">Reset filters</Button>
            </Link>
          }
        />
      )
    }
    throw error
  }

  const [timeZone, settings, projects, tags] = await Promise.all([
    getViewerTimeZone(),
    getSettings(db, user.id),
    listProjects(db, user.id),
    listTags(db, user.id),
  ])

  const result = await listTasks(db, user.id, query, {
    timeZone,
    weekStartsOn: settings.weekStartsOn,
  })

  const hasFilters = Object.keys(params).some((key) => key !== 'page')

  return (
    <div className="space-y-4">
      <TaskFilters projects={projects} tags={tags} total={result.total} />

      <TaskList
        tasks={result.items}
        timeZone={timeZone}
        emptyTitle={hasFilters ? 'No tasks match these filters' : 'No tasks yet'}
        emptyDescription={
          hasFilters
            ? 'Try widening the search, or clear the filters to see everything.'
            : 'Create your first task and it will show up here.'
        }
        emptyAction={
          hasFilters ? (
            <Link href="/tasks">
              <Button variant="secondary">Clear filters</Button>
            </Link>
          ) : (
            <Link href="/tasks/new">
              <Button leadingIcon={<Plus className="size-4" />}>New task</Button>
            </Link>
          )
        }
      />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize || DEFAULT_PAGE_SIZE}
      />
    </div>
  )
}
