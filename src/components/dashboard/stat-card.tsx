import Link from 'next/link'
import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'

type Tone = 'default' | 'danger' | 'warning' | 'success'

const TONES: Record<Tone, { value: string; icon: string }> = {
  default: { value: 'text-foreground', icon: 'bg-surface-muted text-foreground-muted' },
  danger: { value: 'text-danger', icon: 'bg-danger-soft text-danger' },
  warning: { value: 'text-amber-600 dark:text-amber-400', icon: 'bg-amber-500/12 text-amber-500' },
  success: { value: 'text-emerald-600 dark:text-emerald-400', icon: 'bg-emerald-500/12 text-emerald-500' },
}

/**
 * A single headline number.
 *
 * When `href` is set the whole card is a link into the task list with the
 * matching filter already applied, so "6 overdue" is one click from the six
 * tasks it counted.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  href,
}: {
  label: string
  value: number | string
  hint?: string
  icon: ComponentType<{ className?: string }>
  tone?: Tone
  href?: string
}) {
  const tones = TONES[tone]

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-foreground-muted">{label}</p>
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', tones.icon)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className={cn('mt-2.5 text-2xl font-semibold tabular-nums', tones.value)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-foreground-subtle">{hint}</p> : null}
    </>
  )

  const className = cn(
    'rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface p-4',
    'shadow-[0_1px_2px_0_rgb(0_0_0/0.04)]',
    href && 'transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-surface-muted/60',
  )

  if (href) {
    return (
      <Link href={href} className={cn(className, 'block')}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}
