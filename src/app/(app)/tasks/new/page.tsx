import type { Metadata } from 'next'

import { TaskForm } from '@/components/tasks/task-form'
import { getDb } from '@/db'
import { requireUserOrRedirect } from '@/lib/auth/current-user'
import { listProjects } from '@/lib/services/projects'
import { listTags } from '@/lib/services/tags'

export const metadata: Metadata = { title: 'New task' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SearchParams = Promise<{ projectId?: string }>

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUserOrRedirect('/tasks/new')
  const db = await getDb()
  const { projectId } = await searchParams

  const [projects, tags] = await Promise.all([listProjects(db, user.id), listTags(db, user.id)])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">New task</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">
          Only a title is required. Everything else can come later.
        </p>
      </div>

      <TaskForm projects={projects} suggestedTags={tags} defaultProjectId={projectId} />
    </div>
  )
}
