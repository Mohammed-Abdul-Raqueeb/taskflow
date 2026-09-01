import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TaskForm } from '@/components/tasks/task-form'
import { StatusBadge } from '@/components/ui/badge'
import { getDb } from '@/db'
import { requireUserOrRedirect } from '@/lib/auth/current-user'
import { NotFoundError } from '@/lib/errors'
import { listProjects } from '@/lib/services/projects'
import { listTags } from '@/lib/services/tags'
import { getTaskById } from '@/lib/services/tasks'

export const metadata: Metadata = { title: 'Edit task' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = Promise<{ id: string }>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditTaskPage({ params }: { params: Params }) {
  const { id } = await params
  const user = await requireUserOrRedirect(`/tasks/${id}/edit`)
  if (!UUID_PATTERN.test(id)) notFound()

  const db = await getDb()

  // A task belonging to someone else is indistinguishable from one that does
  // not exist: the service scopes by user id, and both land on this 404.
  let task
  try {
    task = await getTaskById(db, user.id, id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const [projects, tags] = await Promise.all([listProjects(db, user.id), listTags(db, user.id)])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{task.title}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">Edit any detail and save.</p>
        </div>
        <StatusBadge status={task.status} className="mt-1" />
      </div>

      <TaskForm task={task} projects={projects} suggestedTags={tags} />
    </div>
  )
}
