import type { ReactNode } from 'react'

import { PRIORITY_META, STATUS_META } from '@/lib/constants'
import { cn, contrastingTextColor, withAlpha } from '@/lib/utils'
import type { TaskPriority, TaskStatus } from '@/types'

const BASE =
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap'

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn(BASE, className)}>{children}</span>
}

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <Badge className={cn(meta.badgeClass, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dotClass)} aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const meta = PRIORITY_META[priority]
  return (
    <Badge className={cn(meta.badgeClass, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dotClass)} aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

/**
 * Project and tag colours are arbitrary user-chosen hex values, so the label
 * colour is derived from the swatch's luminance rather than fixed.
 */
export function ColorBadge({
  color,
  label,
  className,
}: {
  color: string
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(BASE, 'ring-transparent', className)}
      style={{ backgroundColor: withAlpha(color, 0.16), color: undefined }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  )
}

export function SolidColorBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className={cn(BASE, 'ring-transparent')}
      style={{ backgroundColor: color, color: contrastingTextColor(color) }}
    >
      {label}
    </span>
  )
}

export function TagChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: withAlpha(color, 0.16) }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {name}
    </span>
  )
}
