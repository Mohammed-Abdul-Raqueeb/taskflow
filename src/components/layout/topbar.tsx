'use client'

import { CheckCircle2, LogOut, Monitor, Moon, Plus, Settings, Sun } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { useTheme } from '@/components/layout/theme-provider'
import { Button } from '@/components/ui/button'
import { Menu } from '@/components/ui/menu'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/api/client'
import { cn, initials } from '@/lib/utils'
import type { ThemePreference, UserDTO } from '@/types'

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system']
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const
const THEME_LABEL = { light: 'Light', dark: 'Dark', system: 'System' } as const

/** Cycles light -> dark -> system, and says which is active for screen readers. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]!

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      title={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[next].toLowerCase()}.`}
      aria-label={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[next].toLowerCase()}.`}
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </Button>
  )
}

export function UserMenu({ user }: { user: UserDTO }) {
  const router = useRouter()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await api.auth.signOut()
      router.replace('/login')
      router.refresh()
    } catch (error) {
      toast.error('Could not sign out', errorMessage(error))
      setSigningOut(false)
    }
  }

  return (
    <Menu
      label="Account"
      items={[
        { label: 'Profile and settings', href: '/settings', icon: <Settings className="size-4" /> },
        {
          label: signingOut ? 'Signing out...' : 'Sign out',
          onSelect: signOut,
          icon: <LogOut className="size-4" />,
          tone: 'danger',
          separated: true,
          disabled: signingOut,
        },
      ]}
      trigger={({ toggle, open, id }) => (
        <button
          id={id}
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'flex items-center gap-2 rounded-full p-0.5 pr-1 transition-colors sm:pr-2.5',
            'hover:bg-surface-muted',
          )}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user.avatarColor }}
            aria-hidden="true"
          >
            {initials(user.name)}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{user.name}</span>
          <span className="sr-only">Open account menu</span>
        </button>
      )}
    />
  )
}

/** Derives the chrome title from the route, so pages do not have to plumb it. */
function usePageTitle(): string {
  const pathname = usePathname()

  if (pathname.startsWith('/tasks/new')) return 'New task'
  if (/^\/tasks\/[^/]+\/edit/.test(pathname)) return 'Edit task'
  if (pathname.startsWith('/tasks')) return 'Tasks'
  if (/^\/projects\/[^/]+/.test(pathname)) return 'Project'
  if (pathname.startsWith('/projects')) return 'Projects'
  if (pathname.startsWith('/calendar')) return 'Calendar'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Dashboard'
}

export function Topbar({ user }: { user: UserDTO }) {
  const title = usePageTitle()

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)]',
        'bg-background/85 px-4 backdrop-blur-md sm:px-6',
      )}
    >
      {/* The logo only appears where the sidebar does not. */}
      <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CheckCircle2 className="size-4.5" aria-hidden="true" />
        </span>
        <span className="sr-only">TaskFlow home</span>
      </Link>

      <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {/* The sidebar owns this action from `md` up; below that it lives here. */}
        <Link
          href="/tasks/new"
          className={cn(
            'hidden h-8 items-center gap-1.5 rounded-[var(--radius-app)] border border-[var(--border)]',
            'bg-surface-muted px-3 text-[13px] font-medium text-foreground transition-colors',
            'hover:bg-surface-hover sm:inline-flex md:hidden',
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          New task
        </Link>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
