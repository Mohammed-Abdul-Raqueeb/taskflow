import { AlertTriangle } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                  Skeletons                                 */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
    />
  )
}

/** A stand-in for the task list while the first page is on its way. */
export function TaskListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="divide-y divide-[var(--border)] overflow-hidden rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface"
      aria-busy="true"
      aria-label="Loading tasks"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-4.5 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[min(60%,18rem)]" />
            <Skeleton className="h-3 w-[min(35%,10rem)]" />
          </div>
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
          <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
        </div>
      ))}
    </div>
  )
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface p-4"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-12" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface p-5',
        className,
      )}
    >
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Empty states                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[calc(var(--radius-app)+2px)] border border-dashed',
        'border-[var(--border-strong)] bg-surface/50 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-muted">
          <Icon className="size-5 text-foreground-subtle" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-foreground-subtle">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error states                                */
/* -------------------------------------------------------------------------- */

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. Please try again.',
  action,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-[calc(var(--radius-app)+2px)] border',
        'border-danger/30 bg-danger-soft/40 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger/12">
        <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-foreground-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Inline form-level error, shown above the submit button. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-app)] border border-danger/30 bg-danger-soft/50 px-3 py-2.5 text-sm text-foreground"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
