'use client'

import { Bell, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'

import { TagChip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { FormError } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage, fieldErrors } from '@/lib/api/client'
import { PRIORITY_META, STATUS_META, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants'
import { formatDateTime, fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { ProjectDTO, TagDTO, TaskDTO } from '@/types'

/**
 * One form for creating and editing.
 *
 * Dates are edited as `datetime-local` in the browser's own zone and converted
 * to absolute instants on the way out, which is what the API and the database
 * store. Server-side field errors are rendered against the matching input.
 */

const QUICK_DUE_OPTIONS = [
  { label: 'Today', days: 0, hour: 17 },
  { label: 'Tomorrow', days: 1, hour: 9 },
  { label: 'Next week', days: 7, hour: 9 },
]

export function TaskForm({
  task,
  projects,
  suggestedTags,
  defaultProjectId,
}: {
  task?: TaskDTO
  projects: ProjectDTO[]
  suggestedTags: TagDTO[]
  defaultProjectId?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const isEdit = Boolean(task)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState(task?.status ?? 'TODO')
  const [priority, setPriority] = useState(task?.priority ?? 'MEDIUM')
  const [projectId, setProjectId] = useState(task?.project?.id ?? defaultProjectId ?? '')
  const [dueDate, setDueDate] = useState(toDateTimeLocalValue(task?.dueDate ?? null))
  const [reminderAt, setReminderAt] = useState(toDateTimeLocalValue(task?.reminderAt ?? null))
  const [tags, setTags] = useState<string[]>(task?.tags.map((tag) => tag.name) ?? [])
  const [tagDraft, setTagDraft] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const tagSuggestions = useMemo(
    () =>
      suggestedTags
        .filter((tag) => !tags.some((name) => name.toLowerCase() === tag.name.toLowerCase()))
        .slice(0, 12),
    [suggestedTags, tags],
  )

  function addTag(raw: string) {
    const name = raw.trim()
    if (!name) return
    if (tags.length >= 12) {
      setErrors((current) => ({ ...current, tags: 'A task can have at most 12 tags' }))
      return
    }
    if (tags.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      setTagDraft('')
      return
    }
    setTags((current) => [...current, name])
    setTagDraft('')
    setErrors((current) => ({ ...current, tags: '' }))
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagDraft)
    } else if (event.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      setTags((current) => current.slice(0, -1))
    }
  }

  function setQuickDue(days: number, hour: number) {
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setHours(hour, 0, 0, 0)
    setDueDate(toDateTimeLocalValue(date))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    if (!title.trim()) {
      setErrors({ title: 'Title is required' })
      return
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      projectId: projectId || null,
      dueDate: fromDateTimeLocalValue(dueDate),
      reminderAt: fromDateTimeLocalValue(reminderAt),
      tags,
    }

    setSubmitting(true)
    try {
      if (isEdit && task) {
        await api.tasks.update(task.id, payload)
        toast.success('Task updated')
      } else {
        await api.tasks.create(payload)
        toast.success('Task created', payload.title)
      }
      router.push('/tasks')
      router.refresh()
    } catch (error) {
      const fields = fieldErrors(error)
      if (Object.keys(fields).length > 0) setErrors(fields)
      setFormError(Object.keys(fields).length > 0 ? null : errorMessage(error))
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!task) return
    setDeleting(true)
    try {
      await api.tasks.remove(task.id)
      toast.success('Task deleted', task.title)
      router.push('/tasks')
      router.refresh()
    } catch (error) {
      toast.error('Could not delete the task', errorMessage(error))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Details" description="What needs doing, and why." />
            <CardBody className="space-y-4">
              <FormError message={formError} />

              <Field label="Title" error={errors.title} required>
                <Input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Draft the launch announcement"
                  maxLength={200}
                  autoFocus={!isEdit}
                  disabled={submitting}
                />
              </Field>

              <Field
                label="Description"
                error={errors.description}
                description="Optional. Context, acceptance criteria, links."
              >
                <Textarea
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add any detail worth remembering later."
                  rows={6}
                  maxLength={5000}
                  disabled={submitting}
                />
              </Field>

              <Field label="Tags" error={errors.tags} description="Press Enter or comma to add.">
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-1.5 rounded-[var(--radius-app)] border p-2',
                    'border-[var(--border-strong)] bg-surface',
                  )}
                >
                  {tags.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-xs"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setTags((current) => current.filter((tag) => tag !== name))}
                        aria-label={`Remove tag ${name}`}
                        className="rounded text-foreground-subtle hover:text-danger"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => addTag(tagDraft)}
                    placeholder={tags.length === 0 ? 'design, urgent, research' : ''}
                    aria-label="Add a tag"
                    maxLength={32}
                    disabled={submitting}
                    className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-foreground-subtle"
                  />
                </div>
              </Field>

              {tagSuggestions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-foreground-subtle">Your tags:</span>
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTag(tag.name)}
                      className="transition-opacity hover:opacity-75"
                      aria-label={`Add tag ${tag.name}`}
                    >
                      <TagChip name={tag.name} color={tag.color} />
                    </button>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Organise" />
            <CardBody className="space-y-4">
              <Field label="Status" error={errors.status}>
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as typeof status)}
                  disabled={submitting}
                >
                  {TASK_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_META[value].label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Priority" error={errors.priority}>
                <Select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as typeof priority)}
                  disabled={submitting}
                >
                  {TASK_PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {PRIORITY_META[value].label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Project"
                error={errors.projectId}
                description={projects.length === 0 ? 'You have no projects yet.' : undefined}
              >
                <Select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Schedule" />
            <CardBody className="space-y-4">
              <Field label="Due date" error={errors.dueDate}>
                <Input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={submitting}
                />
              </Field>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_DUE_OPTIONS.map((option) => (
                  <Button
                    key={option.label}
                    variant="secondary"
                    size="sm"
                    onClick={() => setQuickDue(option.days, option.hour)}
                    disabled={submitting}
                  >
                    {option.label}
                  </Button>
                ))}
                {dueDate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDueDate('')
                      setReminderAt('')
                    }}
                    disabled={submitting}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              <Field
                label="Reminder"
                error={errors.reminderAt}
                description="Optional, and must be on or before the due date."
              >
                <Input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(event) => setReminderAt(event.target.value)}
                  disabled={submitting}
                />
              </Field>

              {reminderAt ? (
                <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
                  <Bell className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  The reminder time is stored on the task and shown here and on the calendar. No
                  email provider is wired up, so nothing is sent yet.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {task ? (
            <Card>
              <CardBody className="pt-5 text-xs text-foreground-subtle">
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt>Created</dt>
                    <dd className="text-foreground-muted">{formatDateTime(task.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Last updated</dt>
                    <dd className="text-foreground-muted">{formatDateTime(task.updatedAt)}</dd>
                  </div>
                  {task.completedAt ? (
                    <div className="flex justify-between gap-3">
                      <dt>Completed</dt>
                      <dd className="text-foreground-muted">{formatDateTime(task.completedAt)}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Sticky action bar so Save is always reachable on a long form. */}
        <div className="sticky bottom-16 z-10 -mx-4 flex items-center gap-2 border-t border-[var(--border)] bg-background/90 px-4 py-3 backdrop-blur md:bottom-0 lg:col-span-3 lg:-mx-8 lg:px-8">
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
          <Link href="/tasks">
            <Button variant="ghost" type="button" disabled={submitting}>
              Cancel
            </Button>
          </Link>

          {task ? (
            <Button
              variant="ghost"
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
              className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
              leadingIcon={<Trash2 className="size-4" />}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        loading={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this task?"
        message={
          <>
            <strong className="font-medium text-foreground">{task?.title}</strong> will be permanently
            deleted. This cannot be undone.
          </>
        }
      />
    </>
  )
}
