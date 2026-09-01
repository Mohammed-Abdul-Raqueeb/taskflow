import { FileQuestion } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted">
        <FileQuestion className="size-6 text-foreground-subtle" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-sm text-foreground-muted">
        This page does not exist, or it belongs to someone else&apos;s account.
      </p>
      <Link href="/dashboard" className="mt-6">
        <Button>Back to dashboard</Button>
      </Link>
    </main>
  )
}
