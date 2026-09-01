'use client'

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

type ToastContextValue = {
  toast: (input: { tone?: ToastTone; title: string; description?: string }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

const DURATION_MS = 5000

const TONE_STYLES: Record<ToastTone, { icon: typeof Info; className: string; iconClass: string }> = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-surface',
    iconClass: 'text-emerald-500',
  },
  error: { icon: XCircle, className: 'border-danger/35 bg-surface', iconClass: 'text-danger' },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-500/30 bg-surface',
    iconClass: 'text-amber-500',
  },
  info: { icon: Info, className: 'border-[var(--border)] bg-surface', iconClass: 'text-primary' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback<ToastContextValue['toast']>(
    ({ tone = 'info', title, description }) => {
      nextId.current += 1
      const id = nextId.current

      setToasts((current) => [...current.slice(-3), { id, tone, title, description }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS),
      )
    },
    [dismiss],
  )

  // Clear any pending timers if the provider itself goes away.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        Polite live region: announcements do not interrupt what a screen-reader
        user is currently reading, which suits confirmations and recoverable
        errors.
      */}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
      >
        {toasts.map((entry) => {
          const tone = TONE_STYLES[entry.tone]
          const Icon = tone.icon

          return (
            <div
              key={entry.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-app)]',
                'border p-3.5 shadow-lg animate-slide-up',
                tone.className,
              )}
            >
              <Icon className={cn('mt-px size-4.5 shrink-0', tone.iconClass)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                {entry.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                    {entry.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                aria-label="Dismiss notification"
                className="-mt-0.5 -mr-0.5 rounded p-1 text-foreground-subtle transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
