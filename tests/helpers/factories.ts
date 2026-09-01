import type { Database } from '@/db'
import { registerUser } from '@/lib/services/users'
import { createProject } from '@/lib/services/projects'
import { createTask } from '@/lib/services/tasks'
import type { ProjectDTO, TaskDTO, UserDTO } from '@/types'
import type { CreateTaskInput } from '@/lib/validation'

let counter = 0

export function uniqueEmail(prefix = 'user'): string {
  counter += 1
  return `${prefix}${counter}@example.com`
}

export async function makeUser(
  db: Database,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<UserDTO> {
  return registerUser(db, {
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? uniqueEmail()).toLowerCase(),
    password: overrides.password ?? 'correct horse battery',
  })
}

export async function makeProject(
  db: Database,
  userId: string,
  overrides: Partial<{ name: string; description: string | null; color: string }> = {},
): Promise<ProjectDTO> {
  counter += 1
  return createProject(db, userId, {
    name: overrides.name ?? `Project ${counter}`,
    description: overrides.description ?? null,
    color: overrides.color ?? '#6366f1',
  })
}

/** Fills in the defaults the create schema would otherwise supply. */
export async function makeTask(
  db: Database,
  userId: string,
  overrides: Partial<CreateTaskInput> = {},
): Promise<TaskDTO> {
  counter += 1
  return createTask(db, userId, {
    title: overrides.title ?? `Task ${counter}`,
    description: overrides.description ?? null,
    status: overrides.status ?? 'TODO',
    priority: overrides.priority ?? 'MEDIUM',
    dueDate: overrides.dueDate ?? null,
    reminderAt: overrides.reminderAt ?? null,
    projectId: overrides.projectId ?? null,
    tags: overrides.tags ?? [],
  })
}

/** An ISO instant `days` from now in the machine's local zone. */
export function daysFromNow(days: number, hour = 12): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

/**
 * An ISO instant `days` from today at a fixed UTC hour.
 *
 * Due-date fixtures use this together with an explicit `now`, so that a suite
 * exercising "overdue" and "due today" gives the same answer whether it runs at
 * 09:00 or at 23:50.
 */
export function utcDaysFromNow(days: number, hour = 12): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, hour, 0, 0, 0),
  ).toISOString()
}

export const UTC = 'UTC'
