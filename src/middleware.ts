import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE_NAME } from '@/lib/constants'

/**
 * A fast first gate in front of the authenticated routes.
 *
 * This is NOT the authentication check. Middleware runs on the edge with no
 * database access, so all it can see is whether a session cookie is present --
 * a forged cookie sails straight through here. The real check is
 * `requireUserOrRedirect()` in the app layout and `requireUser()` in every Route
 * Handler, both of which resolve the token against the sessions table.
 *
 * What this buys is the common case: a signed-out visitor is redirected before
 * any page work happens, and they land back where they were headed afterwards.
 */

const PROTECTED_PREFIXES = ['/dashboard', '/tasks', '/projects', '/calendar', '/settings']

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (!isProtected) return NextResponse.next()

  if (request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(url)
}

export const config = {
  // Skip static assets and API routes; the API returns 401 JSON rather than a
  // redirect, which is what a fetch caller wants.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
