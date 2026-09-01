'use client'

import { Check, Pencil, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/api/client'
import { TAG_COLORS } from '@/lib/constants'
import { cn, pluralize } from '@/lib/utils'
import type { TagDTO } from '@/types'

/**
 * Tag management.
 *
 * Tags are normally created by typing them on a task, so this panel exists for
 * the housekeeping that has nowhere else to live: renaming one everywhere it is
 * used, recolouring it, or deleting it.
 */
export function TagsPanel({ tags }: { tags: TagDTO[] }) {
  const router = useRouter()
  const toast = useToast()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [toDelete, setToDelete] = useState<TagDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function rename(tag: TagDTO) {
    const name = draftName.trim()
    if (!name || name === tag.name) {
      setEditingId(null)
      return
    }

    setBusy(true)
    try {
      await api.tags.update(tag.id, { name })
      toast.success('Tag renamed', `"${tag.name}" is now "${name}".`)
      setEditingId(null)
      router.refresh()
    } catch (error) {
      toast.error('Could not rename the tag', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function recolor(tag: TagDTO, color: string) {
    setBusy(true)
    try {
      await api.tags.update(tag.id, { color })
      router.refresh()
    } catch (error) {
      toast.error('Could not update the tag', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const name = newName.trim()
    if (!name) return

    setBusy(true)
    try {
      await api.tags.create({ name, color: TAG_COLORS[0] })
      toast.success('Tag created', name)
      setNewName('')
      setCreating(false)
      router.refresh()
    } catch (error) {
      toast.error('Could not create the tag', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setBusy(true)
    try {
      await api.tags.remove(toDelete.id)
      toast.success('Tag deleted', `Removed from ${pluralize(toDelete.taskCount ?? 0, 'task')}.`)
      setToDelete(null)
      router.refresh()
    } catch (error) {
      toast.error('Could not delete the tag', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Tags"
          description="Renaming a tag updates it on every task that uses it."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreating((open) => !open)}
              leadingIcon={<Plus className="size-3.5" />}
            >
              New tag
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {creating ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void create()
                  }
                  if (event.key === 'Escape') setCreating(false)
                }}
                placeholder="Tag name"
                aria-label="New tag name"
                maxLength={32}
                disabled={busy}
                autoFocus
              />
              <Button size="sm" onClick={create} loading={busy} disabled={!newName.trim()}>
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          ) : null}

          {tags.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-foreground-subtle">
              <TagIcon className="size-4" aria-hidden="true" />
              No tags yet. Add one to a task and it will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center gap-3 py-2.5">
                  {editingId === tag.id ? (
                    <>
                      <Input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void rename(tag)
                          }
                          if (event.key === 'Escape') setEditingId(null)
                        }}
                        aria-label={`Rename ${tag.name}`}
                        maxLength={32}
                        disabled={busy}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => rename(tag)}
                        aria-label="Save tag name"
                        disabled={busy}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel rename"
                        disabled={busy}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{tag.name}</span>

                      <span className="hidden items-center gap-1 sm:flex">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => recolor(tag, color)}
                            disabled={busy}
                            aria-label={`Colour ${tag.name} ${color}`}
                            aria-pressed={tag.color.toLowerCase() === color.toLowerCase()}
                            className={cn(
                              'size-4 rounded-full transition-transform hover:scale-110',
                              tag.color.toLowerCase() === color.toLowerCase() &&
                                'ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--surface)]',
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>

                      <span className="shrink-0 text-xs tabular-nums text-foreground-subtle">
                        {tag.taskCount ?? 0}
                      </span>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          setEditingId(tag.id)
                          setDraftName(tag.name)
                        }}
                        aria-label={`Rename ${tag.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-danger hover:bg-danger-soft"
                        onClick={() => setToDelete(tag)}
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        loading={busy}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this tag?"
        message={
          <>
            <strong className="font-medium text-foreground">{toDelete?.name}</strong> will be removed
            from {pluralize(toDelete?.taskCount ?? 0, 'task')}. The tasks themselves are kept.
          </>
        }
      />
    </>
  )
}
