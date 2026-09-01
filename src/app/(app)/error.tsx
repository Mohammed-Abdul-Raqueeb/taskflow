'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/states'

/** Keeps the sidebar and navigation in place while one page fails. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[taskflow] Page error:', error)
  }, [error])

  return (
    <ErrorState
      title="This page could not be loaded"
      description="The request failed on its way to the server. Try again in a moment."
      action={<Button onClick={reset}>Try again</Button>}
      className="mt-6"
    />
  )
}
