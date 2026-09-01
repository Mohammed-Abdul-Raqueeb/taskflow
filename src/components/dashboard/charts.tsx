import { cn } from '@/lib/utils'
import type { TrendPoint } from '@/types'

/**
 * Charts are hand-drawn SVG rather than a charting library.
 *
 * Three small, fixed shapes do not justify shipping a chart runtime to the
 * browser, and being plain SVG they render on the server with no hydration and
 * read correctly in both themes because they use the same tokens as everything
 * else. Each one is exposed as a single labelled image to assistive tech, with
 * the underlying numbers also present as text nearby.
 */

/* -------------------------------------------------------------------------- */
/*                                Progress ring                               */
/* -------------------------------------------------------------------------- */

export function ProgressRing({
  value,
  size = 132,
  strokeWidth = 12,
  label,
  sublabel,
}: {
  /** 0-100. */
  value: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
}) {
  const clamped = Math.min(Math.max(value, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${clamped}% complete`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{label ?? `${clamped}%`}</span>
        {sublabel ? (
          <span className="mt-0.5 text-[11px] text-foreground-subtle">{sublabel}</span>
        ) : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Horizontal breakdown                           */
/* -------------------------------------------------------------------------- */

export type BreakdownItem = {
  label: string
  value: number
  color: string
  href?: string
}

export function BarBreakdown({ items, emptyLabel = 'Nothing to show yet.' }: {
  items: BreakdownItem[]
  emptyLabel?: string
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-foreground-subtle">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const percent = Math.round((item.value / total) * 100)
        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-foreground-muted">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium text-foreground">{item.value}</span>
                <span className="ml-1.5 text-xs text-foreground-subtle">{percent}%</span>
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
              role="img"
              aria-label={`${item.label}: ${item.value} of ${total}, ${percent} percent`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${percent}%`, backgroundColor: item.color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Activity trend                              */
/* -------------------------------------------------------------------------- */

const CREATED_COLOR = 'var(--color-primary)'
const COMPLETED_COLOR = '#10b981'

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 100
  const height = 34
  const max = Math.max(1, ...points.map((point) => Math.max(point.created, point.completed)))
  const slot = width / Math.max(points.length, 1)
  const barWidth = Math.max(slot * 0.3, 0.9)
  const gap = slot * 0.12

  const totalCreated = points.reduce((sum, point) => sum + point.created, 0)
  const totalCompleted = points.reduce((sum, point) => sum + point.completed, 0)

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label={`Activity over the last ${points.length} days: ${totalCreated} tasks created, ${totalCompleted} completed.`}
      >
        {/* Baseline, so empty days still read as days rather than as a gap. */}
        <line
          x1="0"
          y1={height - 0.4}
          x2={width}
          y2={height - 0.4}
          stroke="var(--border)"
          strokeWidth="0.4"
        />

        {points.map((point, index) => {
          const createdHeight = (point.created / max) * (height - 3)
          const completedHeight = (point.completed / max) * (height - 3)
          const left = index * slot + slot / 2 - barWidth - gap / 2

          return (
            <g key={point.date}>
              <title>{`${point.date}: ${point.created} created, ${point.completed} completed`}</title>
              <rect
                x={left}
                y={height - 0.6 - createdHeight}
                width={barWidth}
                height={Math.max(createdHeight, point.created > 0 ? 0.8 : 0)}
                rx={barWidth / 3}
                fill={CREATED_COLOR}
                opacity="0.85"
              />
              <rect
                x={left + barWidth + gap}
                y={height - 0.6 - completedHeight}
                width={barWidth}
                height={Math.max(completedHeight, point.completed > 0 ? 0.8 : 0)}
                rx={barWidth / 3}
                fill={COMPLETED_COLOR}
                opacity="0.9"
              />
            </g>
          )
        })}
      </svg>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <LegendSwatch color={CREATED_COLOR} label={`Created (${totalCreated})`} />
          <LegendSwatch color={COMPLETED_COLOR} label={`Completed (${totalCompleted})`} />
        </div>
        <span className="text-foreground-subtle">Last {points.length} days</span>
      </div>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-foreground-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Inline progress bar                           */
/* -------------------------------------------------------------------------- */

export function ProgressBar({
  value,
  color = 'var(--primary)',
  className,
  label,
}: {
  value: number
  color?: string
  className?: string
  label?: string
}) {
  const clamped = Math.min(Math.max(value, 0), 100)
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  )
}
