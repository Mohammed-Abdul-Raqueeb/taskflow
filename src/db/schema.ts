import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* -------------------------------------------------------------------------- */
/*                                    Enums                                   */
/* -------------------------------------------------------------------------- */

export const taskStatusEnum = pgEnum('task_status', ['TODO', 'IN_PROGRESS', 'COMPLETED'])
export const taskPriorityEnum = pgEnum('task_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
export const themeEnum = pgEnum('theme_preference', ['light', 'dark', 'system'])

/* -------------------------------------------------------------------------- */
/*                                    Users                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Always stored lower-cased and trimmed, so uniqueness is case-insensitive. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    /** scrypt digest, formatted `scrypt$N$r$p$salt$hash`. Never a raw password. */
    passwordHash: text('password_hash').notNull(),
    /** Hex colour used for the initials avatar. */
    avatarColor: text('avatar_color').notNull().default('#6366f1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
)

/* -------------------------------------------------------------------------- */
/*                                  Sessions                                  */
/* -------------------------------------------------------------------------- */

/**
 * Server-side sessions. The cookie carries a random 32-byte token, but only the
 * SHA-256 digest of that token is persisted, so a database leak cannot be
 * replayed as a login.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
)

/* -------------------------------------------------------------------------- */
/*                               User settings                                */
/* -------------------------------------------------------------------------- */

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: themeEnum('theme').notNull().default('system'),
  emailNotifications: boolean('email_notifications').notNull().default(true),
  dueDateReminders: boolean('due_date_reminders').notNull().default(true),
  weeklyDigest: boolean('weekly_digest').notNull().default(false),
  /** 0 = Sunday, 1 = Monday. Drives the calendar grid. */
  weekStartsOn: integer('week_starts_on').notNull().default(1),
  defaultTaskView: text('default_task_view').notNull().default('list'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/* -------------------------------------------------------------------------- */
/*                                  Projects                                  */
/* -------------------------------------------------------------------------- */

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('#6366f1'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Case-insensitive uniqueness of project names, scoped per user.
    uniqueIndex('projects_user_name_unique').on(table.userId, sql`lower(${table.name})`),
    index('projects_user_id_idx').on(table.userId),
  ],
)

/* -------------------------------------------------------------------------- */
/*                                    Tags                                    */
/* -------------------------------------------------------------------------- */

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#64748b'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tags_user_name_unique').on(table.userId, sql`lower(${table.name})`),
    index('tags_user_id_idx').on(table.userId),
  ],
)

/* -------------------------------------------------------------------------- */
/*                                    Tasks                                   */
/* -------------------------------------------------------------------------- */

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Deleting a project keeps its tasks. They simply become unassigned. */
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('TODO'),
    priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    reminderAt: timestamp('reminder_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Every read path is scoped by user_id first, so it leads each composite index.
    index('tasks_user_status_idx').on(table.userId, table.status),
    index('tasks_user_priority_idx').on(table.userId, table.priority),
    index('tasks_user_due_date_idx').on(table.userId, table.dueDate),
    index('tasks_user_project_idx').on(table.userId, table.projectId),
    index('tasks_user_created_idx').on(table.userId, table.createdAt.desc()),
    // Supports the overdue / due-today counters, which always filter on an
    // incomplete status plus a due-date range.
    index('tasks_user_status_due_idx').on(table.userId, table.status, table.dueDate),
  ],
)

/* -------------------------------------------------------------------------- */
/*                        Tasks <-> Tags (many-to-many)                       */
/* -------------------------------------------------------------------------- */

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index('task_tags_tag_id_idx').on(table.tagId),
  ],
)

/* -------------------------------------------------------------------------- */
/*                                  Relations                                 */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many, one }) => ({
  tasks: many(tasks),
  projects: many(projects),
  tags: many(tags),
  sessions: many(sessions),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(tasks),
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  taskTags: many(taskTags),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  taskTags: many(taskTags),
}))

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] }),
}))

/* -------------------------------------------------------------------------- */
/*                              Inferred row types                            */
/* -------------------------------------------------------------------------- */

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type SessionRow = typeof sessions.$inferSelect
export type UserSettingsRow = typeof userSettings.$inferSelect
export type ProjectRow = typeof projects.$inferSelect
export type NewProjectRow = typeof projects.$inferInsert
export type TagRow = typeof tags.$inferSelect
export type TaskRow = typeof tasks.$inferSelect
export type NewTaskRow = typeof tasks.$inferInsert

export type TaskStatus = (typeof taskStatusEnum.enumValues)[number]
export type TaskPriority = (typeof taskPriorityEnum.enumValues)[number]
export type ThemePreference = (typeof themeEnum.enumValues)[number]
