'use client'

import {
  CalendarClock,
  Check,
  CircleDashed,
  ListChecks,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PriorityBadge, StatusBadge, TagChip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Menu } from '@/components/ui/menu'
import { EmptyState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/api/client'
import { formatDate, formatRelativeDay, isOverdue } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TaskDTO } from '@/types'

/**
 * The task list.
 *
 * Checking the box updates local state immediately and only then talks to the
 * server, so the interaction never waits on a round trip. A failure puts the
 * original row back and says why.
 */
export function TaskList({
  tasks,
  timeZone,
  emptyTitle = 'No tasks yet',
  emptyDescription = 'Create your first task to see it here.',
  emptyAction,
}: {
  tasks: TaskDTO[]
  timeZone: string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
}) {
  const router = useRouter()
  const toast = useToast()

  const [items, setItems] = useState(tasks)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [taskToDelete, setTaskToDelete] = useState<TaskDTO | null>(null)
  const [deleting, setDeleting] = useState(false)

  /*
   * Adopt fresh server data after a navigation or router.refresh().
   *
   * Adjusting state during render (rather than in an effect) is the documented
   * way to react to a changed prop: React discards this render and restarts
   * with the new value, so there is no flash of the stale list.
   */
  const [lastServerTasks, setLastServerTasks] = useState(tasks)
  if (tasks !== lastServerTasks) {
    setLastServerTasks(tasks)
    setItems(tasks)
  }

  function markPending(id: string, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function toggleComplete(task: TaskDTO) {
    const completed = task.status !== 'COMPLETED'
    const snapshot = items

    setItems((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              status: completed ? 'COMPLETED' : 'TODO',
              completedAt: completed ? new Date().toISOString() : null,
            }
          : entry,
      ),
    )
    markPending(task.id, true)

    try {
      await api.tasks.setCompleted(task.id, completed)
      // Counters and filtered views elsewhere on the page depend on this.
      router.refresh()
    } catch (error) {
      setItems(snapshot)
      toast.error('Could not update the task', errorMessage(error))
    } finally {
      markPending(task.id, false)
    }
  }

  async function confirmDelete() {
    if (!taskToDelete) return
    setDeleting(true)
    try {
      await api.tasks.remove(taskToDelete.id)
      setItems((current) => current.filter((entry) => entry.id !== taskToDelete.id))
      toast.success('Task deleted', `"${taskToDelete.title}" has been removed.`)
      setTaskToDelete(null)
      router.refresh()
    } catch (error) {
      toast.error('Could not delete the task', errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <>
      <ul
        aria-label="Tasks"
        className="divide-y divide-[var(--border)] overflow-hidden rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface"
      >
        {items.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            timeZone={timeZone}
            pending={pendingIds.has(task.id)}
            onToggle={() => toggleComplete(task)}
            onDelete={() => setTaskToDelete(task)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        loading={deleting}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this task?"
        message={
          <>
            <strong className="font-medium text-foreground">{taskToDelete?.title}</strong> will be
            permanently deleted. This cannot be undone.
          </>
        }
      />
    </>
  )
}

function TaskRow({
  task,
  timeZone,
  pending,
  onToggle,
  onDelete,
}: {
  task: TaskDTO
  timeZone: string
  pending: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const completed = task.status === 'COMPLETED'
  const overdue = isOverdue(task)

  return (
    <li className={cn('group transition-colors hover:bg-surface-muted/50', pending && 'opacity-60')}>
      <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          role="checkbox"
          aria-checked={completed}
          aria-label={completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            completed
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-[var(--border-strong)] hover:border-primary',
          )}
        >
          {completed ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/tasks/${task.id}/edit`}
              className={cn(
                'text-sm font-medium break-words underline-offset-2 hover:underline',
                completed ? 'text-foreground-subtle line-through' : 'text-foreground',
              )}
            >
              {task.title}
            </Link>

            {/* Badges sit on the same line from `sm` up, and wrap below the
                title on phones. */}
            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </div>
          </div>

          {task.description ? (
            <p className="mt-1 line-clamp-1 text-xs text-foreground-subtle">{task.description}</p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-foreground-subtle">
            <span className="flex items-center gap-1.5 sm:hidden">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </span>

            {task.project ? (
              <Link
                href={`/projects/${task.project.id}`}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: task.project.color }}
                  aria-hidden="true"
                />
                {task.project.name}
              </Link>
            ) : null}

            {task.dueDate ? (
              <span
                className={cn('flex items-center gap-1', overdue && 'font-medium text-danger')}
                title={formatDate(task.dueDate, timeZone)}
              >
                <CalendarClock className="size-3.5" aria-hidden="true" />
                {formatRelativeDay(task.dueDate, timeZone)}
                {overdue ? <span className="sr-only">(overdue)</span> : null}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CircleDashed className="size-3.5" aria-hidden="true" />
                No due date
              </span>
            )}

            {task.tags.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1">
                {task.tags.map((tag) => (
                  <TagChip key={tag.id} name={tag.name} color={tag.color} />
                ))}
              </span>
            ) : null}

            <span className="hidden text-foreground-subtle lg:inline">
              Created {formatDate(task.createdAt, timeZone)}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <Menu
            label={`Actions for ${task.title}`}
            items={[
              {
                label: 'Edit task',
                href: `/tasks/${task.id}/edit`,
                icon: <Pencil className="size-4" />,
              },
              {
                label: completed ? 'Mark as not done' : 'Mark as done',
                onSelect: onToggle,
                icon: completed ? <RotateCcw className="size-4" /> : <Check className="size-4" />,
              },
              {
                label: 'Delete task',
                onSelect: onDelete,
                icon: <Trash2 className="size-4" />,
                tone: 'danger',
                separated: true,
              },
            ]}
            trigger={({ toggle, open, id }) => (
              <Button
                id={id}
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Actions for ${task.title}`}
                className="size-8"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            )}
          />
        </div>
      </div>
    </li>
  )
}

/** Compact, read-only rows for the dashboard panels. */
export function TaskMiniList({
  tasks,
  timeZone,
  emptyMessage,
}: {
  tasks: TaskDTO[]
  timeZone: string
  emptyMessage: string
}) {
  if (tasks.length === 0) {
    return <p className="py-6 text-center text-sm text-foreground-subtle">{emptyMessage}</p>
  }

  return (
    <ul className="-mx-2 divide-y divide-[var(--border)]">
      {tasks.map((task) => {
        const overdue = isOverdue(task)
        return (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}/edit`}
              className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-muted"
            >
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  task.status === 'COMPLETED' ? 'bg-emerald-500' : overdue ? 'bg-danger' : 'bg-primary',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-sm',
                    task.status === 'COMPLETED'
                      ? 'text-foreground-subtle line-through'
                      : 'text-foreground',
                  )}
                >
                  {task.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-foreground-subtle">
                  {task.project?.name ?? 'No project'}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 text-xs whitespace-nowrap',
                  overdue ? 'font-medium text-danger' : 'text-foreground-subtle',
                )}
              >
                {formatRelativeDay(task.dueDate, timeZone)}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
