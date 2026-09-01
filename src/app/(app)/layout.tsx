import type { ReactNode } from 'react'

import { MobileTabBar, Sidebar } from '@/components/layout/nav'
import { Topbar } from '@/components/layout/topbar'
import { getDb } from '@/db'
import { requireUserOrRedirect } from '@/lib/auth/current-user'
import { listProjects } from '@/lib/services/projects'

/**
 * The authenticated shell.
 *
 * Every route nested here is gated: `requireUserOrRedirect` runs on the server
 * before any child renders, so an unauthenticated visitor never receives the
 * markup, let alone the data.
 */
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect()

  const db = await getDb()
  const projects = await listProjects(db, user.id)

  return (
    <div className="min-h-dvh">
      <Sidebar projects={projects} />

      {/* Offsets match the sidebar's three widths: none, rail, full. */}
      <div className="md:pl-20 lg:pl-64">
        <Topbar user={user} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-24 sm:px-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  )
}
