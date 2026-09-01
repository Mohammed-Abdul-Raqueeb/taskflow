import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { sessions, users } from '@/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import {
  createSession,
  destroyOtherSessions,
  destroySession,
  hashSessionToken,
  pruneExpiredSessions,
  resolveSession,
} from '@/lib/auth/session'
import { SESSION_DURATION_MS, SESSION_RENEW_THRESHOLD_MS } from '@/lib/constants'
import { ConflictError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { authenticateUser, changePassword, registerUser, updateProfile } from '@/lib/services/users'
import { parseOrThrow, signUpSchema } from '@/lib/validation'
import { createTestDatabase, type TestDatabase } from './helpers/db'
import { makeUser } from './helpers/factories'

let ctx: TestDatabase

beforeAll(async () => {
  ctx = await createTestDatabase()
})
afterAll(async () => {
  await ctx.close()
})
beforeEach(async () => {
  await ctx.reset()
})

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('a good password')

    await expect(verifyPassword('a good password', hash)).resolves.toBe(true)
    await expect(verifyPassword('a good passworD', hash)).resolves.toBe(false)
    await expect(verifyPassword('', hash)).resolves.toBe(false)
  })

  it('never stores the password itself, and salts each hash', async () => {
    const first = await hashPassword('repeated password')
    const second = await hashPassword('repeated password')

    expect(first).not.toContain('repeated password')
    expect(first).not.toEqual(second)
    expect(first.startsWith('scrypt$')).toBe(true)
  })

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false)
    await expect(verifyPassword('x', 'scrypt$1$2$3$bm8=$bm8=')).resolves.toBe(false)
  })
})

describe('registration', () => {
  it('creates a user with default settings and a hashed password', async () => {
    const user = await registerUser(ctx.db, {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'analytical engine',
    })

    expect(user.email).toBe('ada@example.com')
    expect(user.name).toBe('Ada Lovelace')

    const rows = await ctx.db.select().from(users).where(eq(users.id, user.id))
    expect(rows[0]?.passwordHash).not.toBe('analytical engine')
    expect(rows[0]?.passwordHash.startsWith('scrypt$')).toBe(true)
  })

  it('rejects a duplicate email regardless of case', async () => {
    await registerUser(ctx.db, { name: 'A', email: 'dup@example.com', password: 'password123' })

    await expect(
      registerUser(ctx.db, { name: 'B', email: 'dup@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictError)

    // The schema lower-cases before the service ever sees the address.
    const normalised = parseOrThrow(signUpSchema, {
      name: 'C',
      email: '  DUP@Example.COM ',
      password: 'password123',
    })
    expect(normalised.email).toBe('dup@example.com')
    await expect(registerUser(ctx.db, normalised)).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('sign in', () => {
  it('accepts the right password', async () => {
    await registerUser(ctx.db, { name: 'Grace', email: 'grace@example.com', password: 'nanoseconds' })

    const user = await authenticateUser(ctx.db, { email: 'grace@example.com', password: 'nanoseconds' })
    expect(user.name).toBe('Grace')
  })

  it('rejects a wrong password and an unknown account with the same message', async () => {
    await registerUser(ctx.db, { name: 'Grace', email: 'grace@example.com', password: 'nanoseconds' })

    const wrongPassword = await authenticateUser(ctx.db, {
      email: 'grace@example.com',
      password: 'wrong',
    }).catch((error: unknown) => error)

    const unknownUser = await authenticateUser(ctx.db, {
      email: 'nobody@example.com',
      password: 'nanoseconds',
    }).catch((error: unknown) => error)

    expect(wrongPassword).toBeInstanceOf(UnauthorizedError)
    expect(unknownUser).toBeInstanceOf(UnauthorizedError)
    // Identical wording, so the response cannot be used to enumerate accounts.
    expect((wrongPassword as UnauthorizedError).message).toBe((unknownUser as UnauthorizedError).message)
  })
})

describe('sessions', () => {
  it('stores only a digest of the token', async () => {
    const user = await makeUser(ctx.db)
    const { token } = await createSession(ctx.db, user.id)

    const rows = await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).not.toBe(token)
    expect(rows[0]?.tokenHash).toBe(hashSessionToken(token))
  })

  it('resolves a valid token to its user', async () => {
    const user = await makeUser(ctx.db, { name: 'Session Owner' })
    const { token } = await createSession(ctx.db, user.id)

    const resolved = await resolveSession(ctx.db, token)
    expect(resolved?.user.id).toBe(user.id)
    expect(resolved?.user.name).toBe('Session Owner')
  })

  it('rejects an unknown, empty or tampered token', async () => {
    const user = await makeUser(ctx.db)
    const { token } = await createSession(ctx.db, user.id)

    await expect(resolveSession(ctx.db, undefined)).resolves.toBeNull()
    await expect(resolveSession(ctx.db, '')).resolves.toBeNull()
    await expect(resolveSession(ctx.db, 'not-a-real-token')).resolves.toBeNull()
    await expect(resolveSession(ctx.db, `${token}x`)).resolves.toBeNull()
  })

  it('refuses an expired session and deletes it', async () => {
    const user = await makeUser(ctx.db)
    const longAgo = new Date(Date.now() - SESSION_DURATION_MS - 60_000)
    const { token } = await createSession(ctx.db, user.id, longAgo)

    await expect(resolveSession(ctx.db, token)).resolves.toBeNull()

    const rows = await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))
    expect(rows).toHaveLength(0)
  })

  it('extends a session that is close to expiring', async () => {
    const user = await makeUser(ctx.db)
    // Created far enough in the past that the remaining life is under the threshold.
    const issuedAt = new Date(Date.now() - (SESSION_DURATION_MS - SESSION_RENEW_THRESHOLD_MS) - 60_000)
    const { token, expiresAt } = await createSession(ctx.db, user.id, issuedAt)

    const resolved = await resolveSession(ctx.db, token)
    expect(resolved?.renewed).toBe(true)
    expect(resolved!.expiresAt.getTime()).toBeGreaterThan(expiresAt.getTime())
  })

  it('signs out by destroying the session row', async () => {
    const user = await makeUser(ctx.db)
    const { token } = await createSession(ctx.db, user.id)

    await destroySession(ctx.db, token)

    await expect(resolveSession(ctx.db, token)).resolves.toBeNull()
    expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0)
  })

  it('can sign out every other device while keeping the current one', async () => {
    const user = await makeUser(ctx.db)
    const keep = await createSession(ctx.db, user.id)
    const phone = await createSession(ctx.db, user.id)
    const laptop = await createSession(ctx.db, user.id)

    await destroyOtherSessions(ctx.db, user.id, keep.token)

    await expect(resolveSession(ctx.db, keep.token)).resolves.not.toBeNull()
    await expect(resolveSession(ctx.db, phone.token)).resolves.toBeNull()
    await expect(resolveSession(ctx.db, laptop.token)).resolves.toBeNull()
  })

  it('prunes expired rows without touching live ones', async () => {
    const user = await makeUser(ctx.db)
    const live = await createSession(ctx.db, user.id)
    await createSession(ctx.db, user.id, new Date(Date.now() - SESSION_DURATION_MS - 1000))

    await pruneExpiredSessions(ctx.db)

    const rows = await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).toBe(hashSessionToken(live.token))
  })

  it('drops a user\'s sessions when the account is deleted', async () => {
    const user = await makeUser(ctx.db)
    const { token } = await createSession(ctx.db, user.id)

    await ctx.db.delete(users).where(eq(users.id, user.id))

    await expect(resolveSession(ctx.db, token)).resolves.toBeNull()
  })
})

describe('account maintenance', () => {
  it('changes a password and invalidates the old one', async () => {
    const user = await registerUser(ctx.db, {
      name: 'Rotator',
      email: 'rotate@example.com',
      password: 'old password 1',
    })

    await changePassword(ctx.db, user.id, {
      currentPassword: 'old password 1',
      newPassword: 'new password 2',
    })

    await expect(
      authenticateUser(ctx.db, { email: 'rotate@example.com', password: 'old password 1' }),
    ).rejects.toBeInstanceOf(UnauthorizedError)

    await expect(
      authenticateUser(ctx.db, { email: 'rotate@example.com', password: 'new password 2' }),
    ).resolves.toMatchObject({ id: user.id })
  })

  it('requires the current password to be correct', async () => {
    const user = await makeUser(ctx.db, { password: 'the real one' })

    await expect(
      changePassword(ctx.db, user.id, { currentPassword: 'a guess', newPassword: 'something new' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('will not let a profile take an email another account already uses', async () => {
    const first = await makeUser(ctx.db, { email: 'first@example.com' })
    await makeUser(ctx.db, { email: 'second@example.com' })

    await expect(
      updateProfile(ctx.db, first.id, { name: 'First', email: 'second@example.com' }),
    ).rejects.toBeInstanceOf(ConflictError)

    // Keeping your own address is fine.
    await expect(
      updateProfile(ctx.db, first.id, { name: 'First Renamed', email: 'first@example.com' }),
    ).resolves.toMatchObject({ name: 'First Renamed' })
  })
})
