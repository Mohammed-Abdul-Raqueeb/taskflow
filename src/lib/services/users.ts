import { eq, ne, and } from 'drizzle-orm'

import type { Database } from '@/db'
import { userSettings, users } from '@/db/schema'
import { equaliseFailedLoginTiming, hashPassword, verifyPassword } from '@/lib/auth/password'
import { PROJECT_COLORS } from '@/lib/constants'
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors'
import type { UserDTO, UserSettingsDTO } from '@/types'
import type { SignInInput, SignUpInput } from '@/lib/validation'

function toUserDTO(row: {
  id: string
  email: string
  name: string
  avatarColor: string
  createdAt: Date
}): UserDTO {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarColor: row.avatarColor,
    createdAt: row.createdAt.toISOString(),
  }
}

function pickAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return PROJECT_COLORS[hash % PROJECT_COLORS.length]!
}

export async function registerUser(db: Database, input: SignUpInput): Promise<UserDTO> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('An account with that email already exists.', {
      email: 'An account with that email already exists.',
    })
  }

  const passwordHash = await hashPassword(input.password)

  const inserted = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash,
      avatarColor: pickAvatarColor(input.email),
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
    })

  const user = inserted[0]
  if (!user) throw new Error('Failed to create user')

  await db.insert(userSettings).values({ userId: user.id })

  return toUserDTO(user)
}

export async function authenticateUser(db: Database, input: SignInInput): Promise<UserDTO> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  const row = rows[0]
  if (!row) {
    // Spend the same CPU as a real verification so timing does not disclose
    // whether the address exists, and return the same message either way.
    await equaliseFailedLoginTiming(input.password)
    throw new UnauthorizedError('Incorrect email or password.')
  }

  const valid = await verifyPassword(input.password, row.passwordHash)
  if (!valid) throw new UnauthorizedError('Incorrect email or password.')

  return toUserDTO(row)
}

export async function getUserById(db: Database, userId: string): Promise<UserDTO | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return rows[0] ? toUserDTO(rows[0]) : null
}

export async function updateProfile(
  db: Database,
  userId: string,
  input: { name: string; email: string; avatarColor?: string },
): Promise<UserDTO> {
  const clash = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, input.email), ne(users.id, userId)))
    .limit(1)

  if (clash.length > 0) {
    throw new ConflictError('That email is already in use.', { email: 'That email is already in use.' })
  }

  const updated = await db
    .update(users)
    .set({
      name: input.name,
      email: input.email,
      ...(input.avatarColor ? { avatarColor: input.avatarColor } : {}),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
    })

  const user = updated[0]
  if (!user) throw new NotFoundError('Account not found.')
  return toUserDTO(user)
}

export async function changePassword(
  db: Database,
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const row = rows[0]
  if (!row) throw new NotFoundError('Account not found.')

  const valid = await verifyPassword(input.currentPassword, row.passwordHash)
  if (!valid) {
    throw new ValidationError('Your current password is incorrect.', {
      currentPassword: 'Your current password is incorrect.',
    })
  }

  if (await verifyPassword(input.newPassword, row.passwordHash)) {
    throw new ValidationError('Choose a password you have not used here before.', {
      newPassword: 'Choose a password you have not used here before.',
    })
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword) })
    .where(eq(users.id, userId))
}

/* -------------------------------------------------------------------------- */
/*                                  Settings                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_SETTINGS: UserSettingsDTO = {
  theme: 'system',
  emailNotifications: true,
  dueDateReminders: true,
  weeklyDigest: false,
  weekStartsOn: 1,
  defaultTaskView: 'list',
}

export async function getSettings(db: Database, userId: string): Promise<UserSettingsDTO> {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  const row = rows[0]
  if (!row) {
    // Older accounts, or a user created outside registerUser, get defaults on demand.
    await db.insert(userSettings).values({ userId }).onConflictDoNothing()
    return DEFAULT_SETTINGS
  }

  return {
    theme: row.theme,
    emailNotifications: row.emailNotifications,
    dueDateReminders: row.dueDateReminders,
    weeklyDigest: row.weeklyDigest,
    weekStartsOn: row.weekStartsOn,
    defaultTaskView: row.defaultTaskView,
  }
}

export async function updateSettings(
  db: Database,
  userId: string,
  input: Partial<UserSettingsDTO>,
): Promise<UserSettingsDTO> {
  await db.insert(userSettings).values({ userId }).onConflictDoNothing()

  const updated = await db
    .update(userSettings)
    .set(input)
    .where(eq(userSettings.userId, userId))
    .returning()

  const row = updated[0]
  if (!row) throw new NotFoundError('Settings not found.')

  return {
    theme: row.theme,
    emailNotifications: row.emailNotifications,
    dueDateReminders: row.dueDateReminders,
    weeklyDigest: row.weeklyDigest,
    weekStartsOn: row.weekStartsOn,
    defaultTaskView: row.defaultTaskView,
  }
}

export async function deleteAccount(db: Database, userId: string): Promise<void> {
  // Every owned row cascades from users.id.
  await db.delete(users).where(eq(users.id, userId))
}
