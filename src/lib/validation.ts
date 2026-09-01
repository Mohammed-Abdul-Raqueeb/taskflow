import { z } from 'zod'

import {
  DUE_FILTERS,
  MAX_PAGE_SIZE,
  SORT_FIELDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  THEMES,
} from '@/lib/constants'
import { ValidationError } from '@/lib/errors'

/* -------------------------------------------------------------------------- */
/*                                  Primitives                                */
/* -------------------------------------------------------------------------- */

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour, for example #6366f1')

/** ISO-8601 instant, or null to clear the value. */
const nullableInstant = z
  .union([z.iso.datetime({ offset: true }), z.literal(''), z.null()])
  .transform((value) => (value === '' || value === null ? null : value))
  .nullable()

/**
 * Normalises before validating, so a stray leading space or a capitalised
 * domain is accepted rather than rejected as "invalid email".
 */
const emailField = (message = 'Enter a valid email address') =>
  z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .pipe(z.email(message).max(255, 'Email must be 255 characters or fewer'))

/**
 * A project reference, where "" and null both mean "no project".
 *
 * Declared without a default on purpose: the create schema adds `.default(null)`,
 * while the update schema must leave a missing key absent so that a PATCH which
 * does not mention the project leaves it alone.
 */
const projectIdField = z
  .union([z.uuid('Choose a valid project'), z.literal(''), z.null()])
  .transform((value) => (value === '' || value === null ? null : value))

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    })
    .refine((value) => value === null || value.length <= max, {
      message: `Must be ${max} characters or fewer`,
    })

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  email: emailField(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password must be 200 characters or fewer'),
})

export const signInSchema = z.object({
  email: emailField(),
  password: z.string().min(1, 'Password is required').max(200),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(200, 'Password must be 200 characters or fewer'),
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  email: emailField(),
  avatarColor: hexColor.optional(),
})

/* -------------------------------------------------------------------------- */
/*                                    Tasks                                   */
/* -------------------------------------------------------------------------- */

const taskCoreShape = {
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: optionalText(5000).optional().default(null),
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  dueDate: nullableInstant.optional().default(null),
  reminderAt: nullableInstant.optional().default(null),
  projectId: projectIdField.optional().default(null),
  /** Free-form tag names. They are created on demand and de-duplicated per user. */
  tags: z
    .array(z.string().trim().min(1).max(32))
    .max(12, 'A task can have at most 12 tags')
    .optional()
    .default([]),
}

export const createTaskSchema = z.object(taskCoreShape).refine(
  (value) => !(value.reminderAt && value.dueDate && new Date(value.reminderAt) > new Date(value.dueDate)),
  { message: 'Reminder must be on or before the due date', path: ['reminderAt'] },
)

export const updateTaskSchema = z
  .object({
    title: taskCoreShape.title.optional(),
    description: optionalText(5000).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: nullableInstant.optional(),
    reminderAt: nullableInstant.optional(),
    projectId: projectIdField.optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(12, 'A task can have at most 12 tags').optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  })
  .refine(
    (value) => !(value.reminderAt && value.dueDate && new Date(value.reminderAt) > new Date(value.dueDate)),
    { message: 'Reminder must be on or before the due date', path: ['reminderAt'] },
  )

export const toggleTaskSchema = z.object({
  completed: z.boolean(),
})

/* -------------------------------------------------------------------------- */
/*                                  Projects                                  */
/* -------------------------------------------------------------------------- */

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  description: optionalText(1000).optional().default(null),
  color: hexColor.optional().default('#6366f1'),
})

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    description: optionalText(1000).optional(),
    color: hexColor.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  })

/* -------------------------------------------------------------------------- */
/*                                    Tags                                    */
/* -------------------------------------------------------------------------- */

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(32, 'Tag must be 32 characters or fewer'),
  color: hexColor.optional().default('#64748b'),
})

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(32).optional(),
    color: hexColor.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  })

/* -------------------------------------------------------------------------- */
/*                                  Settings                                  */
/* -------------------------------------------------------------------------- */

export const updateSettingsSchema = z
  .object({
    theme: z.enum(THEMES).optional(),
    emailNotifications: z.boolean().optional(),
    dueDateReminders: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
    defaultTaskView: z.enum(['list', 'grid']).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  })

/* -------------------------------------------------------------------------- */
/*                              Task list querying                            */
/* -------------------------------------------------------------------------- */

/** Accepts `?status=TODO&status=DONE` as well as `?status=TODO,DONE`. */
function csvArray<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (raw === undefined) return undefined
      const list = (Array.isArray(raw) ? raw : [raw]).flatMap((entry) => entry.split(','))
      const cleaned = list.map((entry) => entry.trim()).filter(Boolean)
      return cleaned.length > 0 ? cleaned : undefined
    })
    .pipe(z.array(z.enum(values)).optional())
}

export const taskQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed && trimmed.length > 0 ? trimmed.slice(0, 200) : undefined
    }),
  status: csvArray(TASK_STATUSES),
  priority: csvArray(TASK_PRIORITIES),
  projectId: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .pipe(z.union([z.uuid(), z.literal('none')]).optional()),
  tagIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (raw === undefined) return undefined
      const list = (Array.isArray(raw) ? raw : [raw]).flatMap((entry) => entry.split(','))
      const cleaned = list.map((entry) => entry.trim()).filter(Boolean)
      return cleaned.length > 0 ? cleaned : undefined
    })
    .pipe(z.array(z.uuid()).max(20).optional()),
  due: z.enum(DUE_FILTERS).optional(),
  sort: z.enum(SORT_FIELDS as unknown as [string, ...string[]]).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
})

export const calendarQuerySchema = z.object({
  /** First visible day of the grid, inclusive. */
  from: z.iso.datetime({ offset: true }),
  /** Last visible day of the grid, inclusive. */
  to: z.iso.datetime({ offset: true }),
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/**
 * Runs a schema and converts a failure into a {@link ValidationError} carrying a
 * `field -> message` map the forms can render inline.
 */
export function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input)
  if (result.success) return result.data

  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_'
    if (!(key in fields)) fields[key] = issue.message
  }

  const firstMessage = result.error.issues[0]?.message ?? 'Invalid input.'
  const onlyFormLevel = Object.keys(fields).length === 1 && '_' in fields
  throw new ValidationError(onlyFormLevel ? firstMessage : 'Please check the highlighted fields.', fields)
}

/** Turns `URLSearchParams` into the shape the query schemas expect. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key)
    output[key] = values.length > 1 ? values : (values[0] ?? '')
  }
  return output
}

export type SignUpInput = z.output<typeof signUpSchema>
export type SignInInput = z.output<typeof signInSchema>
export type CreateTaskInput = z.output<typeof createTaskSchema>
export type UpdateTaskInput = z.output<typeof updateTaskSchema>
export type CreateProjectInput = z.output<typeof createProjectSchema>
export type UpdateProjectInput = z.output<typeof updateProjectSchema>
export type UpdateSettingsInput = z.output<typeof updateSettingsSchema>
export type TaskQueryInput = z.output<typeof taskQuerySchema>
