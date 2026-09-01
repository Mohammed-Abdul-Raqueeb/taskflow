'use client'

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PriorityBadge, StatusBadge, TagChip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/api/client'
import { PRIORITY_META } from '@/lib/constants'
import { formatDateTime, toDateKey } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TaskDTO } from '@/types'

/**
 * Month calendar.
 *
 * The grid is built from the viewer's local calendar, and a task is placed on a
 * day by comparing date keys in the viewer's zone -- so a task due at 23:00 in
 * Tokyo lands on the Tokyo day, not the UTC one.
 *
 * On phones the cells carry dots rather than pills, and the day's detail moves
 * into the panel underneath, which is a layout for the screen rather than a
 * squeezed version of the desktop one.
 */
export function CalendarView({
  initialTasks,
  timeZone,
  weekStartsOn,
}: {
  initialTasks: TaskDTO[]
  timeZone: string
  weekStartsOn: number
}) {
  const toast = useToast()
  const weekStart = (weekStartsOn === 0 ? 0 : 1) as 0 | 1

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date(), timeZone))
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null)
  const serverMonthConsumed = useRef(false)

  const { gridStart, gridEnd, days } = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: weekStart })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: weekStart })
    return { gridStart: start, gridEnd: end, days: eachDayOfInterval({ start, end }) }
  }, [cursor, weekStart])

  const loadRange = useCallback(
    async (from: Date, to: Date) => {
      setLoading(true)
      setLoadError(null)
      try {
        const result = await api.calendar.range(from.toISOString(), to.toISOString())
        setTasks(result.tasks)
      } catch (error) {
        setLoadError(errorMessage(error))
        toast.error('Could not load the calendar', errorMessage(error))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  // The first month arrives from the server; only later navigation fetches.
  useEffect(() => {
    if (!serverMonthConsumed.current) {
      serverMonthConsumed.current = true
      return
    }
    void loadRange(gridStart, gridEnd)
  }, [gridStart, gridEnd, loadRange])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDTO[]>()
    for (const task of tasks) {
      if (!task.dueDate) continue
      const key = toDateKey(new Date(task.dueDate), timeZone)
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    }
    return map
  }, [tasks, timeZone])

  const todayKey = toDateKey(new Date(), timeZone)
  const selectedTasks = tasksByDay.get(selectedKey) ?? []
  const weekdayLabels = useMemo(
    () =>
      eachDayOfInterval({ start: gridStart, end: new Date(gridStart.getTime() + 6 * 86_400_000) }).map(
        (day) => format(day, 'EEE'),
      ),
    [gridStart],
  )

  function goToToday() {
    setCursor(startOfMonth(new Date()))
    setSelectedKey(todayKey)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setCursor((current) => addMonths(current, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <h3 className="min-w-40 text-center text-base font-semibold tracking-tight sm:min-w-48 sm:text-lg">
            {format(cursor, 'MMMM yyyy')}
          </h3>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setCursor((current) => addMonths(current, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {loading ? <span className="text-xs text-foreground-subtle">Loading...</span> : null}
          <Link href="/tasks/new">
            <Button size="sm" leadingIcon={<Plus className="size-4" />}>
              New task
            </Button>
          </Link>
        </div>
      </div>

      {loadError ? (
        <ErrorState
          title="Could not load this month"
          description={loadError}
          action={
            <Button variant="secondary" onClick={() => loadRange(gridStart, gridEnd)}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface">
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-surface-muted/50">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="px-1 py-2 text-center text-[11px] font-medium tracking-wide text-foreground-subtle uppercase"
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.charAt(0)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = toDateKey(day, timeZone)
              const dayTasks = tasksByDay.get(key) ?? []
              const outside = !isSameMonth(day, cursor)
              const isToday = key === todayKey
              const isSelected = key === selectedKey

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${format(day, 'EEEE d MMMM yyyy')}, ${dayTasks.length} ${
                    dayTasks.length === 1 ? 'task' : 'tasks'
                  }`}
                  className={cn(
                    'relative min-h-16 border-r border-b border-[var(--border)] p-1 text-left align-top sm:min-h-24 sm:p-1.5',
                    'transition-colors last:border-r-0 hover:bg-surface-muted/70',
                    outside && 'bg-surface-muted/30',
                    isSelected && 'bg-primary-soft/45 ring-1 ring-inset ring-[var(--primary)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                      isToday && 'bg-primary font-semibold text-primary-foreground',
                      !isToday && outside && 'text-foreground-subtle',
                      !isToday && !outside && 'text-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Phones: dots only, so the grid stays legible. */}
                  <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {dayTasks.slice(0, 4).map((task) => (
                      <span
                        key={task.id}
                        className={cn(
                          'size-1.5 rounded-full',
                          task.status === 'COMPLETED' && 'opacity-45',
                        )}
                        style={{ backgroundColor: PRIORITY_META[task.priority].chartColor }}
                      />
                    ))}
                  </span>

                  <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                    {dayTasks.slice(0, 3).map((task) => (
                      <span
                        key={task.id}
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-[10px] leading-tight',
                          task.status === 'COMPLETED'
                            ? 'text-foreground-subtle line-through'
                            : 'text-foreground',
                        )}
                        style={{
                          backgroundColor: `${PRIORITY_META[task.priority].chartColor}22`,
                        }}
                        title={task.title}
                      >
                        {task.title}
                      </span>
                    ))}
                    {dayTasks.length > 3 ? (
                      <span className="px-1 text-[10px] text-foreground-subtle">
                        +{dayTasks.length - 3} more
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            {format(new Date(`${selectedKey}T12:00:00`), 'EEEE d MMMM')}
            {selectedKey === todayKey ? (
              <span className="ml-2 text-xs font-normal text-primary">Today</span>
            ) : null}
          </h3>
          <span className="text-xs text-foreground-subtle">
            {selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : selectedTasks.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-foreground-subtle">
              <CalendarDays className="size-4" aria-hidden="true" />
              Nothing due on this day.
            </p>
          ) : (
            <ul className="space-y-1">
              {selectedTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => setOpenTask(task)}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-app)] px-2.5 py-2.5 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: PRIORITY_META[task.priority].chartColor }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm',
                          task.status === 'COMPLETED' && 'text-foreground-subtle line-through',
                        )}
                      >
                        {task.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-foreground-subtle">
                        {task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : ''}
                        {task.project ? ` · ${task.project.name}` : ''}
                      </span>
                    </span>
                    <StatusBadge status={task.status} className="hidden shrink-0 sm:inline-flex" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TaskDetailDialog task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}

function TaskDetailDialog({ task, onClose }: { task: TaskDTO | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(task)}
      onClose={onClose}
      title={task?.title ?? ''}
      footer={
        task ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Link href={`/tasks/${task.id}/edit`}>
              <Button>Open task</Button>
            </Link>
          </>
        ) : null
      }
    >
      {task ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.tags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
            ))}
          </div>

          {task.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground-muted">
              {task.description}
            </p>
          ) : (
            <p className="text-sm text-foreground-subtle">No description.</p>
          )}

          <dl className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 text-xs">
            <div>
              <dt className="text-foreground-subtle">Project</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-foreground">
                {task.project ? (
                  <>
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: task.project.color }}
                      aria-hidden="true"
                    />
                    {task.project.name}
                  </>
                ) : (
                  'No project'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">Due</dt>
              <dd className="mt-0.5 text-foreground">{formatDateTime(task.dueDate)}</dd>
            </div>
            {task.reminderAt ? (
              <div>
                <dt className="text-foreground-subtle">Reminder</dt>
                <dd className="mt-0.5 text-foreground">{formatDateTime(task.reminderAt)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-foreground-subtle">Created</dt>
              <dd className="mt-0.5 text-foreground">{formatDateTime(task.createdAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Dialog>
  )
}
