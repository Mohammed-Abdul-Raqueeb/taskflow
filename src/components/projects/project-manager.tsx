'use client'

import { FolderKanban, MoreHorizontal, Pencil, Plus, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { ProgressBar } from '@/components/dashboard/charts'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Menu } from '@/components/ui/menu'
import { EmptyState, FormError } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage, fieldErrors } from '@/lib/api/client'
import { PROJECT_COLORS } from '@/lib/constants'
import { cn, pluralize } from '@/lib/utils'
import type { ProjectDTO } from '@/types'

/**
 * Project list with inline create, edit, archive and delete.
 *
 * Deleting a project keeps its tasks -- the foreign key is ON DELETE SET NULL --
 * and the confirmation says so, because "delete project" reads like it would
 * take the tasks with it.
 */
export function ProjectManager({ projects }: { projects: ProjectDTO[] }) {
  const router = useRouter()
  const toast = useToast()

  const [items, setItems] = useState(projects)
  const [editing, setEditing] = useState<ProjectDTO | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<ProjectDTO | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Adopt fresh server data after router.refresh(), adjusting during render.
  const [lastServerProjects, setLastServerProjects] = useState(projects)
  if (projects !== lastServerProjects) {
    setLastServerProjects(projects)
    setItems(projects)
  }

  async function toggleArchive(project: ProjectDTO) {
    try {
      await api.projects.update(project.id, { isArchived: !project.isArchived })
      toast.success(project.isArchived ? 'Project restored' : 'Project archived', project.name)
      router.refresh()
    } catch (error) {
      toast.error('Could not update the project', errorMessage(error))
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.projects.remove(toDelete.id)
      setItems((current) => current.filter((entry) => entry.id !== toDelete.id))
      toast.success('Project deleted', `Its ${pluralize(toDelete.taskCount, 'task')} moved to "No project".`)
      setToDelete(null)
      router.refresh()
    } catch (error) {
      toast.error('Could not delete the project', errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Projects</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Group related tasks and watch each project close out.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} leadingIcon={<Plus className="size-4" />}>
          New project
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Projects are optional, but they make a long task list far easier to read."
          action={
            <Button onClick={() => setCreating(true)} leadingIcon={<Plus className="size-4" />}>
              Create a project
            </Button>
          }
          className="py-14"
        />
      ) : (
        <ul aria-label="Projects" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                onEdit={() => setEditing(project)}
                onDelete={() => setToDelete(project)}
                onToggleArchive={() => toggleArchive(project)}
              />
            </li>
          ))}
        </ul>
      )}

      <ProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          router.refresh()
        }}
      />

      <ProjectDialog
        key={editing?.id ?? 'none'}
        project={editing ?? undefined}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          router.refresh()
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        loading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this project?"
        message={
          <>
            <strong className="font-medium text-foreground">{toDelete?.name}</strong> will be deleted.
            {toDelete && toDelete.taskCount > 0 ? (
              <>
                {' '}
                Its {pluralize(toDelete.taskCount, 'task')} will be kept and moved to{' '}
                <strong className="font-medium text-foreground">No project</strong>.
              </>
            ) : null}
          </>
        }
      />
    </>
  )
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
  onToggleArchive,
}: {
  project: ProjectDTO
  onEdit: () => void
  onDelete: () => void
  onToggleArchive: () => void
}) {
  const remaining = project.taskCount - project.completedCount

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface p-4',
        'transition-colors hover:border-[var(--border-strong)]',
        project.isArchived && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projects/${project.id}`} className="min-w-0 flex-1 group">
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden="true"
            />
            <span className="truncate text-sm font-semibold group-hover:underline">{project.name}</span>
            {project.isArchived ? (
              <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-foreground-subtle">
                Archived
              </span>
            ) : null}
          </span>
          {project.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground-subtle">
              {project.description}
            </p>
          ) : null}
        </Link>

        <Menu
          label={`Actions for ${project.name}`}
          items={[
            { label: 'Edit project', onSelect: onEdit, icon: <Pencil className="size-4" /> },
            {
              label: project.isArchived ? 'Restore project' : 'Archive project',
              onSelect: onToggleArchive,
              icon: project.isArchived ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              ),
            },
            {
              label: 'Delete project',
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
              aria-label={`Actions for ${project.name}`}
              className="size-8 shrink-0"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          )}
        />
      </div>

      <div className="mt-4 flex-1" />

      <div>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-foreground-muted">
            {project.taskCount === 0
              ? 'No tasks yet'
              : `${remaining} open of ${pluralize(project.taskCount, 'task')}`}
          </span>
          <span className="font-medium tabular-nums text-foreground">{project.progress}%</span>
        </div>
        <ProgressBar
          value={project.progress}
          color={project.color}
          className="mt-1.5"
          label={`${project.name}: ${project.progress}% complete`}
        />
      </div>
    </div>
  )
}

export function ProjectDialog({
  project,
  open,
  onClose,
  onSaved,
}: {
  project?: ProjectDTO
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const isEdit = Boolean(project)

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    if (!name.trim()) {
      setErrors({ name: 'Name is required' })
      return
    }

    const payload = { name: name.trim(), description: description.trim() || null, color }

    setSaving(true)
    try {
      if (isEdit && project) {
        await api.projects.update(project.id, payload)
        toast.success('Project updated', payload.name)
      } else {
        await api.projects.create(payload)
        toast.success('Project created', payload.name)
        setName('')
        setDescription('')
      }
      onSaved()
    } catch (error) {
      const fields = fieldErrors(error)
      if (Object.keys(fields).length > 0) setErrors(fields)
      setFormError(Object.keys(fields).length > 0 ? null : errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? 'Edit project' : 'New project'}
      description={isEdit ? undefined : 'Give it a name and a colour. You can change both later.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError message={formError} />

        <Field label="Name" error={errors.name} required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Website Redesign"
            maxLength={80}
            disabled={saving}
            autoFocus
          />
        </Field>

        <Field label="Description" error={errors.description}>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this project for?"
            rows={3}
            maxLength={1000}
            disabled={saving}
          />
        </Field>

        <Field label="Colour" error={errors.color}>
          <div className="flex flex-wrap gap-2 pt-1">
            {PROJECT_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={`Use colour ${option}`}
                aria-pressed={color === option}
                disabled={saving}
                className={cn(
                  'size-7 rounded-full transition-transform',
                  color === option
                    ? 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--surface)]'
                    : 'hover:scale-110',
                )}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
        </Field>

        {/* Lets the form submit on Enter without a visible duplicate button. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  )
}
