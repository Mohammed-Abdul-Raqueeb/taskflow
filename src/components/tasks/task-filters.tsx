'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { DUE_FILTERS, PRIORITY_META, SORT_FIELDS, STATUS_META, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ProjectDTO, TagDTO } from '@/types'

/**
 * Search, filter and sort controls.
 *
 * All state lives in the URL, which means a filtered view is shareable and
 * survives a refresh, the back button works, and the server does the filtering
 * with a real SQL query rather than the client hiding rows it already fetched.
 *
 * Typing is debounced so a search costs one request, not one per keystroke.
 */

const SEARCH_DEBOUNCE_MS = 300

const DUE_LABELS: Record<(typeof DUE_FILTERS)[number], string> = {
  any: 'Any due date',
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
  week: 'Due this week',
  month: 'Due within a month',
  none: 'No due date',
}

const SORT_LABELS: Record<(typeof SORT_FIELDS)[number], string> = {
  dueDate: 'Due date',
  priority: 'Priority',
  createdAt: 'Created',
  updatedAt: 'Updated',
  title: 'Title',
  status: 'Status',
}

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.getAll(key).flatMap((value) => value.split(','))
  return raw.map((value) => value.trim()).filter(Boolean)
}

export function TaskFilters({
  projects,
  tags,
  total,
}: {
  projects: ProjectDTO[]
  tags: TagDTO[]
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlSearch = searchParams.get('search') ?? ''
  const [searchDraft, setSearchDraft] = useState(urlSearch)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  /*
   * Keep the input in step when the URL changes from elsewhere -- the back
   * button, or "clear filters". Adjusting during render rather than in an
   * effect means the box never shows a stale term for a frame.
   */
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch)
    setSearchDraft(urlSearch)
  }

  const statuses = readList(searchParams, 'status')
  const priorities = readList(searchParams, 'priority')
  const tagIds = readList(searchParams, 'tagIds')
  const projectId = searchParams.get('projectId') ?? ''
  const due = searchParams.get('due') ?? 'any'
  const sort = searchParams.get('sort') ?? 'createdAt'
  const direction = searchParams.get('direction') ?? 'desc'

  const activeCount =
    statuses.length +
    priorities.length +
    tagIds.length +
    (projectId ? 1 : 0) +
    (due !== 'any' ? 1 : 0)

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      // Any change to the result set invalidates the current page number.
      params.delete('page')

      startTransition(() => {
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams],
  )

  // Debounce the search so typing costs one request, not one per keystroke.
  useEffect(() => {
    if (searchDraft === urlSearch) return

    const timer = setTimeout(() => {
      push((params) => {
        if (searchDraft.trim()) params.set('search', searchDraft.trim())
        else params.delete('search')
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchDraft, urlSearch, push])

  function toggleInList(key: string, value: string) {
    push((params) => {
      const current = readList(params, key)
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]

      params.delete(key)
      if (next.length > 0) params.set(key, next.join(','))
    })
  }

  function setSingle(key: string, value: string, clearWhen: string) {
    push((params) => {
      if (!value || value === clearWhen) params.delete(key)
      else params.set(key, value)
    })
  }

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'All projects' },
      { value: 'none', label: 'No project' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects],
  )

  return (
    <div className="space-y-3">
      {/*
        On a phone the search box gets a row to itself and the controls sit
        below it. Sharing one row at this width squeezed the input down to an
        unusable stub and clipped the Filters label.
      */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full min-w-0 sm:max-w-md sm:flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search title, description, project or tag"
            aria-label="Search tasks"
            className={cn(
              'h-9.5 w-full rounded-[var(--radius-app)] border border-[var(--border-strong)] bg-surface',
              'pr-9 pl-9 text-sm text-foreground placeholder:text-foreground-subtle',
              'transition-colors hover:border-[color-mix(in_oklab,var(--border-strong),var(--foreground)_18%)]',
            )}
          />
          {searchDraft ? (
            <button
              type="button"
              onClick={() => setSearchDraft('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-foreground-subtle hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:contents">
          <Button
            variant={advancedOpen || activeCount > 0 ? 'secondary' : 'ghost'}
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            leadingIcon={<SlidersHorizontal className="size-4" />}
            className="shrink-0"
          >
            Filters
            {activeCount > 0 ? (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
                {activeCount}
              </span>
            ) : null}
          </Button>

          <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <label htmlFor="task-sort" className="hidden text-xs text-foreground-subtle sm:block">
              Sort
            </label>
            <Select
              id="task-sort"
              aria-label="Sort tasks by"
              value={sort}
              onChange={(event) => setSingle('sort', event.target.value, 'createdAt')}
              className="min-w-0 flex-1 sm:w-auto sm:min-w-32 sm:flex-none"
            >
              {SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {SORT_LABELS[field]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Sort direction"
              value={direction}
              onChange={(event) => setSingle('direction', event.target.value, 'desc')}
              className="min-w-0 flex-1 sm:w-auto sm:min-w-28 sm:flex-none"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
        </div>
      </div>

      {advancedOpen ? (
        <div className="space-y-4 rounded-[calc(var(--radius-app)+2px)] border border-[var(--border)] bg-surface p-4 animate-fade-in">
          <FilterGroup label="Status">
            {TASK_STATUSES.map((status) => (
              <FilterChip
                key={status}
                active={statuses.includes(status)}
                onClick={() => toggleInList('status', status)}
              >
                {STATUS_META[status].label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="Priority">
            {TASK_PRIORITIES.map((priority) => (
              <FilterChip
                key={priority}
                active={priorities.includes(priority)}
                onClick={() => toggleInList('priority', priority)}
                dotColor={PRIORITY_META[priority].chartColor}
              >
                {PRIORITY_META[priority].label}
              </FilterChip>
            ))}
          </FilterGroup>

          {tags.length > 0 ? (
            <FilterGroup label="Tags">
              {tags.map((tag) => (
                <FilterChip
                  key={tag.id}
                  active={tagIds.includes(tag.id)}
                  onClick={() => toggleInList('tagIds', tag.id)}
                  dotColor={tag.color}
                >
                  {tag.name}
                </FilterChip>
              ))}
            </FilterGroup>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="filter-project"
                className="mb-1.5 block text-xs font-medium tracking-wide text-foreground-subtle uppercase"
              >
                Project
              </label>
              <Select
                id="filter-project"
                value={projectId}
                onChange={(event) => setSingle('projectId', event.target.value, '')}
              >
                {projectOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label
                htmlFor="filter-due"
                className="mb-1.5 block text-xs font-medium tracking-wide text-foreground-subtle uppercase"
              >
                Due date
              </label>
              <Select
                id="filter-due"
                value={due}
                onChange={(event) => setSingle('due', event.target.value, 'any')}
              >
                {DUE_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {DUE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {activeCount > 0 || searchDraft ? (
            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchDraft('')
                  startTransition(() => router.replace(pathname, { scroll: false }))
                }}
                leadingIcon={<X className="size-3.5" />}
              >
                Clear all filters
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p aria-live="polite" className="text-xs text-foreground-subtle">
        {isPending ? 'Updating...' : `${total} ${total === 1 ? 'task' : 'tasks'}`}
      </p>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-foreground-subtle uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}

function FilterChip({
  active,
  onClick,
  dotColor,
  children,
}: {
  active: boolean
  onClick: () => void
  dotColor?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-[var(--border)] text-foreground-muted hover:border-[var(--border-strong)] hover:text-foreground',
      )}
    >
      {dotColor ? (
        <span className="size-1.5 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}

/** Page links that preserve whatever filters are currently applied. */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) params.delete('page')
    else params.set('page', String(nextPage))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Task list pages"
      className="flex flex-wrap items-center justify-between gap-3 pt-1"
    >
      <p className="text-xs text-foreground-subtle tabular-nums">
        Showing {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          Previous
        </Button>
        <span className="text-xs text-foreground-muted tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
