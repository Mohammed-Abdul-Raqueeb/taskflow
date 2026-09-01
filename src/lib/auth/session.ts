import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, lt } from 'drizzle-orm'

import type { Database } from '@/db'
import { sessions, users } from '@/db/schema'
import { SESSION_DURATION_MS, SESSION_RENEW_THRESHOLD_MS } from '@/lib/constants'
import { getAuthSecret } from '@/lib/env'
import type { UserDTO } from '@/types'

/**
 * Session storage, independent of any HTTP framework.
 *
 * The browser holds a 256-bit random token. The database holds only its HMAC,
 * keyed by AUTH_SECRET, so read access to the sessions table is not enough to
 * mint a valid cookie.
 *
 * Kept free of `next/headers` on purpose: the cookie plumbing lives in
 * `current-user.ts`, which lets this module be unit-tested directly.
 */

export type ResolvedSession = {
  user: UserDTO
  sessionId: string
  expiresAt: Date
  /** True when the caller should refresh the cookie with a later expiry. */
  renewed: boolean
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHmac('sha256', getAuthSecret()).update(token).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

export async function createSession(
  db: Database,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken()
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  })

  return { token, expiresAt }
}

export async function resolveSession(
  db: Database,
  token: string | undefined | null,
  now: Date = new Date(),
): Promise<ResolvedSession | null> {
  if (!token) return null

  const tokenHash = hashSessionToken(token)

  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      storedHash: sessions.tokenHash,
      id: users.id,
      email: users.email,
      name: users.name,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  // The lookup above is already an equality match; this second comparison keeps
  // the check constant-time with respect to the stored value.
  if (!safeEqualHex(row.storedHash, tokenHash)) return null

  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId))
    return null
  }

  // Sliding expiry: an actively used session is extended, but only once it has
  // aged past the threshold, so we are not writing on every request.
  let expiresAt = row.expiresAt
  let renewed = false
  if (row.expiresAt.getTime() - now.getTime() < SESSION_RENEW_THRESHOLD_MS) {
    expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, row.sessionId))
    renewed = true
  }

  return {
    sessionId: row.sessionId,
    expiresAt,
    renewed,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarColor: row.avatarColor,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function destroySession(db: Database, token: string | undefined | null): Promise<void> {
  if (!token) return
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)))
}

/** Used after a password change so other devices are signed out. */
export async function destroyOtherSessions(
  db: Database,
  userId: string,
  keepToken?: string | null,
): Promise<void> {
  if (keepToken) {
    const keepHash = hashSessionToken(keepToken)
    const rows = await db
      .select({ id: sessions.id, tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.userId, userId))
    const doomed = rows.filter((row) => row.tokenHash !== keepHash).map((row) => row.id)
    await Promise.all(doomed.map((id) => db.delete(sessions).where(eq(sessions.id, id))))
    return
  }
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

/** Opportunistic cleanup of expired rows. Safe to call from any request path. */
export async function pruneExpiredSessions(db: Database, now: Date = new Date()): Promise<void> {
  await db.delete(sessions).where(and(lt(sessions.expiresAt, now)))
}
