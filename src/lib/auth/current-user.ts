import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { getDb } from '@/db'
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS, TIMEZONE_COOKIE_NAME } from '@/lib/constants'
import { normalizeTimeZone } from '@/lib/date'
import { useSecureCookies } from '@/lib/env'
import { UnauthorizedError } from '@/lib/errors'
import { resolveSession, type ResolvedSession } from '@/lib/auth/session'
import type { UserDTO } from '@/types'

/**
 * Request-scoped access to the signed-in user.
 *
 * `cache()` memoises the lookup for the lifetime of one request, so a layout,
 * a page and three components can each ask "who is signed in?" and the session
 * is still resolved once.
 */
export const getCurrentSession = cache(async (): Promise<ResolvedSession | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const db = await getDb()
  const session = await resolveSession(db, token)
  if (!session) return null

  if (session.renewed) {
    // Server Components cannot write cookies. When the renewal happens during a
    // page render the database expiry is still extended; the browser cookie
    // catches up on the next request that goes through a Route Handler.
    try {
      jar.set(buildSessionCookie(token, session.expiresAt))
    } catch {
      // Read-only cookie context. Nothing to do.
    }
  }

  return session
})

export async function getCurrentUser(): Promise<UserDTO | null> {
  return (await getCurrentSession())?.user ?? null
}

/** For Route Handlers: throws a 401 that the error mapper turns into JSON. */
export async function requireUser(): Promise<UserDTO> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

/** For pages: sends the visitor to sign in, preserving where they were headed. */
export async function requireUserOrRedirect(returnTo?: string): Promise<UserDTO> {
  const user = await getCurrentUser()
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'
    redirect(target)
  }
  return user
}

/* -------------------------------------------------------------------------- */
/*                                   Cookies                                  */
/* -------------------------------------------------------------------------- */

type SessionCookieOptions = {
  name: string
  value: string
  httpOnly: boolean
  sameSite: 'lax'
  secure: boolean
  path: string
  expires: Date
}

function buildSessionCookie(token: string, expiresAt: Date): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    // `lax` still sends the cookie on top-level navigations, which is what a
    // returning user needs, while blocking it on cross-site subrequests.
    sameSite: 'lax',
    secure: useSecureCookies,
    path: '/',
    expires: expiresAt,
  }
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies()
  jar.set(buildSessionCookie(token, expiresAt))
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies,
    path: '/',
    maxAge: 0,
  })
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_DURATION_MS / 1000)

/**
 * The viewer's IANA time zone, reported by a small client-side effect and kept
 * in a non-sensitive cookie. Day-boundary maths ("due today", "overdue") runs
 * on the server, so it needs to know which calendar the viewer is looking at.
 */
export async function getViewerTimeZone(): Promise<string> {
  const jar = await cookies()
  return normalizeTimeZone(jar.get(TIMEZONE_COOKIE_NAME)?.value)
}
