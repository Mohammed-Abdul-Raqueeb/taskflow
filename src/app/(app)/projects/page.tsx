import type { Metadata } from 'next'

import { ProjectManager } from '@/components/projects/project-manager'
import { getDb } from '@/db'
import { requireUserOrRedirect } from '@/lib/auth/current-user'
import { listProjects } from '@/lib/services/projects'

export const metadata: Metadata = { title: 'Projects' }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ProjectsPage() {
  const user = await requireUserOrRedirect('/projects')
  const db = await getDb()

  // Archived projects stay visible here so they can be restored or deleted.
  const projects = await listProjects(db, user.id, { includeArchived: true })

  return (
    <div className="space-y-5">
      <ProjectManager projects={projects} />
    </div>
  )
}
