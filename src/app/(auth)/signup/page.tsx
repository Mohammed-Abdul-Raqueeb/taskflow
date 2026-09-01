import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { AuthForm } from '@/components/auth/auth-form'
import { Skeleton } from '@/components/ui/states'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Create an account' }
export const dynamic = 'force-dynamic'

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect('/dashboard')

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuthForm mode="signup" />
    </Suspense>
  )
}
