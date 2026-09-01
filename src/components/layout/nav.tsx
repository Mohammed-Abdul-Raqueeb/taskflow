'use client'

import {
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Plus,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'
import type { ProjectDTO } from '@/types'

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The persistent side navigation.
 *
 * Three layouts, not one that shrinks: hidden below `md`, an icon rail from
 * `md`, and a full labelled sidebar with project shortcuts from `lg`.
 */
export function Sidebar({ projects }: { projects: ProjectDTO[] }) {
  const isActive = useIsActive()

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col border-r border-[var(--border)] bg-surface',
        'md:flex md:w-20 lg:w-64',
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-4 lg:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CheckCircle2 className="size-4.5" aria-hidden="true" />
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight lg:inline">TaskFlow</span>
      </div>

      <div className="p-3 lg:px-4">
        <Link
          href="/tasks/new"
          className={cn(
            'flex h-9.5 items-center justify-center gap-2 rounded-[var(--radius-app)] bg-primary',
            'text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover',
          )}
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden lg:inline">New task</span>
          <span className="sr-only lg:hidden">New task</span>
        </Link>
      </div>

      <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4 lg:px-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  title={label}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--radius-app)] px-3 py-2 text-sm font-medium',
                    'transition-colors duration-150 md:justify-center lg:justify-start',
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <span className="hidden lg:inline">{label}</span>
                  <span className="sr-only lg:hidden">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {projects.length > 0 ? (
          <div className="mt-7 hidden lg:block">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-foreground-subtle uppercase">
              Projects
            </p>
            <ul className="mt-2 space-y-0.5">
              {projects.slice(0, 8).map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-app)] px-3 py-1.5 text-sm',
                      'transition-colors duration-150',
                      isActive(`/projects/${project.id}`)
                        ? 'bg-surface-muted text-foreground'
                        : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-foreground-subtle">
                      {project.taskCount - project.completedCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>
    </aside>
  )
}

/**
 * Bottom tab bar for phones.
 *
 * Thumb-reachable, five destinations, and it replaces the sidebar entirely
 * below `md` rather than sitting alongside a collapsed version of it.
 */
export function MobileTabBar() {
  const isActive = useIsActive()

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-surface/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)] md:hidden',
      )}
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-foreground-subtle hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
