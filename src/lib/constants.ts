import type { TaskPriority, TaskStatus } from '@/db/schema'

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'] as const
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export const THEMES = ['light', 'dark', 'system'] as const

export type SortField = 'dueDate' | 'priority' | 'createdAt' | 'title' | 'status' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'
export type DueFilter = 'any' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'month' | 'none'

export const SORT_FIELDS: readonly SortField[] = [
  'dueDate',
  'priority',
  'createdAt',
  'title',
  'status',
  'updatedAt',
]

export const DUE_FILTERS: readonly DueFilter[] = [
  'any',
  'overdue',
  'today',
  'tomorrow',
  'week',
  'month',
  'none',
]

type StatusMeta = {
  value: TaskStatus
  label: string
  /** Tailwind classes for the badge, tuned for both themes. */
  badgeClass: string
  dotClass: string
  /** Hex used by the SVG charts, which cannot read Tailwind classes. */
  chartColor: string
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  TODO: {
    value: 'TODO',
    label: 'To do',
    badgeClass:
      'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    dotClass: 'bg-slate-400',
    chartColor: '#94a3b8',
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In progress',
    badgeClass:
      'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800',
    dotClass: 'bg-sky-500',
    chartColor: '#0ea5e9',
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
    dotClass: 'bg-emerald-500',
    chartColor: '#10b981',
  },
}

type PriorityMeta = {
  value: TaskPriority
  label: string
  /** Higher sorts first when ordering by priority descending. */
  weight: number
  badgeClass: string
  dotClass: string
  chartColor: string
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  LOW: {
    value: 'LOW',
    label: 'Low',
    weight: 1,
    badgeClass:
      'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    dotClass: 'bg-slate-400',
    chartColor: '#94a3b8',
  },
  MEDIUM: {
    value: 'MEDIUM',
    label: 'Medium',
    weight: 2,
    badgeClass:
      'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
    dotClass: 'bg-blue-500',
    chartColor: '#3b82f6',
  },
  HIGH: {
    value: 'HIGH',
    label: 'High',
    weight: 3,
    badgeClass:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
    dotClass: 'bg-amber-500',
    chartColor: '#f59e0b',
  },
  URGENT: {
    value: 'URGENT',
    label: 'Urgent',
    weight: 4,
    badgeClass:
      'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800',
    dotClass: 'bg-rose-500',
    chartColor: '#f43f5e',
  },
}

/** Anything at or above this counts as "high priority" on the dashboard. */
export const HIGH_PRIORITY_VALUES: readonly TaskPriority[] = ['HIGH', 'URGENT']

export const PROJECT_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
] as const

export const TAG_COLORS = [
  '#64748b',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
] as const

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

/** Session lifetime, and the window inside which an active session is renewed. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000
export const SESSION_RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000
export const SESSION_COOKIE_NAME = 'taskflow_session'
export const THEME_COOKIE_NAME = 'taskflow_theme'
export const TIMEZONE_COOKIE_NAME = 'taskflow_tz'
