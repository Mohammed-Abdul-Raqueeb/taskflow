import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

/** The root is a signpost: straight to work if signed in, otherwise to sign-in. */
export default async function RootPage() {
  const user = await getCurrentUser()
  redirect(user ? '/dashboard' : '/login')
}
