'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

/**
 * A small dropdown menu.
 *
 * Keyboard support is the point of writing it by hand rather than using a
 * `<details>`: Escape closes and returns focus, arrow keys move between items,
 * Home/End jump to the ends, and a click anywhere outside dismisses it.
 */

export type MenuItem = {
  label: string
  onSelect?: () => void
  href?: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Draws a divider above this item. */
  separated?: boolean
}

export function Menu({
  trigger,
  items,
  align = 'end',
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const triggerId = useId()

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    setActiveIndex(-1)
    if (restoreFocus) {
      containerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(triggerId)}`)?.focus()
    }
  }, [triggerId])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open, close])

  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  const enabledIndexes = items.map((item, index) => (item.disabled ? -1 : index)).filter((i) => i >= 0)

  function moveFocus(direction: 1 | -1) {
    if (enabledIndexes.length === 0) return
    const position = enabledIndexes.indexOf(activeIndex)
    const nextPosition =
      position === -1
        ? direction === 1
          ? 0
          : enabledIndexes.length - 1
        : (position + direction + enabledIndexes.length) % enabledIndexes.length
    setActiveIndex(enabledIndexes[nextPosition]!)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(true)
        setActiveIndex(enabledIndexes[0] ?? -1)
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-1)
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(enabledIndexes[0] ?? -1)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(enabledIndexes.at(-1) ?? -1)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {trigger({ open, toggle: () => setOpen((current) => !current), id: triggerId })}

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute top-[calc(100%+6px)] z-40 min-w-52 overflow-hidden rounded-[var(--radius-app)]',
            'border border-[var(--border)] bg-surface p-1 shadow-lg animate-scale-in',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, index) => {
            const className = cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
              'transition-colors duration-100 outline-none',
              item.disabled
                ? 'cursor-not-allowed text-foreground-subtle opacity-60'
                : item.tone === 'danger'
                  ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
                  : 'text-foreground hover:bg-surface-muted focus-visible:bg-surface-muted',
            )

            const content = (
              <>
                {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                {item.label}
              </>
            )

            return (
              <div key={item.label}>
                {item.separated ? (
                  <div className="my-1 h-px bg-[var(--border)]" role="separator" />
                ) : null}
                {item.href && !item.disabled ? (
                  <a
                    ref={(element) => {
                      itemRefs.current[index] = element
                    }}
                    role="menuitem"
                    tabIndex={-1}
                    href={item.href}
                    className={className}
                    onClick={() => close(false)}
                  >
                    {content}
                  </a>
                ) : (
                  <button
                    ref={(element) => {
                      itemRefs.current[index] = element
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    disabled={item.disabled}
                    className={className}
                    onClick={() => {
                      if (item.disabled) return
                      close(false)
                      item.onSelect?.()
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
