'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Last-resort boundary for an unhandled render error.
 *
 * The user sees a plain apology and a way forward; the underlying error goes to
 * the console (and to whatever error reporter is wired up), never onto the page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[taskflow] Unhandled render error:', error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-1.5 max-w-md text-sm text-foreground-muted">
        We hit an unexpected error while loading this page. Trying again usually clears it.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-foreground-subtle">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <a href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </a>
      </div>
    </main>
  )
}
