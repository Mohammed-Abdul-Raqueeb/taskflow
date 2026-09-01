import 'dotenv/config'

import { eq } from 'drizzle-orm'

import { getDb, type Database } from '../src/db'
import { runMigrations } from '../src/db/migrator'
import { projects, tags, taskTags, tasks, userSettings, users } from '../src/db/schema'
import { SEED_PROJECTS, SEED_SECOND_USER, SEED_TAGS, SEED_TASKS } from '../src/db/seed-data'
import { hashPassword } from '../src/lib/auth/password'

/**
 * Idempotent demo seed.
 *
 * Re-running it wipes and recreates the demo accounts only; any other account
 * in the database is left untouched.
 */

const DEMO_EMAIL = (process.env.SEED_USER_EMAIL ?? 'demo@taskflow.app').toLowerCase()
const DEMO_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'demo1234'
const DEMO_NAME = 'Demo User'

const DAY_MS = 24 * 60 * 60 * 1000

function atOffset(days: number, hour: number, base: Date): Date {
  const date = new Date(base.getTime() + days * DAY_MS)
  date.setHours(hour, 0, 0, 0)
  return date
}

async function removeExistingUser(db: Database, email: string) {
  // Projects, tasks, tags, settings and sessions all cascade from users.id.
  await db.delete(users).where(eq(users.email, email))
}

async function seedPrimaryUser(db: Database, now: Date) {
  await removeExistingUser(db, DEMO_EMAIL)

  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      avatarColor: '#6366f1',
    })
    .returning({ id: users.id })

  if (!user) throw new Error('Failed to create the demo user')
  await db.insert(userSettings).values({ userId: user.id })

  const projectRows = await db
    .insert(projects)
    .values(
      SEED_PROJECTS.map((project) => ({
        userId: user.id,
        name: project.name,
        description: project.description,
        color: project.color,
      })),
    )
    .returning({ id: projects.id, name: projects.name })

  const projectIdByKey = new Map<string, string>()
  for (const seed of SEED_PROJECTS) {
    const row = projectRows.find((candidate) => candidate.name === seed.name)
    if (row) projectIdByKey.set(seed.key, row.id)
  }

  const tagRows = await db
    .insert(tags)
    .values(SEED_TAGS.map((tag) => ({ userId: user.id, name: tag.name, color: tag.color })))
    .returning({ id: tags.id, name: tags.name })

  const tagIdByName = new Map(tagRows.map((row) => [row.name, row.id]))

  const taskValues = SEED_TASKS.map((seed, index) => {
    const dueDate =
      seed.dueInDays === undefined ? null : atOffset(seed.dueInDays, seed.dueHour ?? 17, now)

    const reminderAt =
      dueDate && seed.remindDaysBefore !== undefined
        ? new Date(dueDate.getTime() - seed.remindDaysBefore * DAY_MS)
        : null

    const createdAt = new Date(now.getTime() - (seed.createdDaysAgo ?? index % 28) * DAY_MS)
    const completedAt =
      seed.status === 'COMPLETED'
        ? new Date(now.getTime() - (seed.completedDaysAgo ?? 1) * DAY_MS)
        : null

    return {
      userId: user.id,
      projectId: seed.project ? (projectIdByKey.get(seed.project) ?? null) : null,
      title: seed.title,
      description: seed.description ?? null,
      status: seed.status,
      priority: seed.priority,
      dueDate,
      reminderAt,
      completedAt,
      createdAt,
      updatedAt: completedAt ?? createdAt,
    }
  })

  const taskRows = await db.insert(tasks).values(taskValues).returning({ id: tasks.id, title: tasks.title })
  const taskIdByTitle = new Map(taskRows.map((row) => [row.title, row.id]))

  const links: { taskId: string; tagId: string }[] = []
  for (const seed of SEED_TASKS) {
    const taskId = taskIdByTitle.get(seed.title)
    if (!taskId || !seed.tags) continue
    for (const tagName of seed.tags) {
      const tagId = tagIdByName.get(tagName)
      if (tagId) links.push({ taskId, tagId })
    }
  }
  if (links.length > 0) await db.insert(taskTags).values(links).onConflictDoNothing()

  return { userId: user.id, projects: projectRows.length, tasks: taskRows.length, tags: tagRows.length }
}

async function seedSecondUser(db: Database, now: Date) {
  const email = SEED_SECOND_USER.email.toLowerCase()
  await removeExistingUser(db, email)

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: SEED_SECOND_USER.name,
      passwordHash: await hashPassword(SEED_SECOND_USER.password),
      avatarColor: '#10b981',
    })
    .returning({ id: users.id })

  if (!user) throw new Error('Failed to create the second demo user')
  await db.insert(userSettings).values({ userId: user.id })

  const [project] = await db
    .insert(projects)
    .values({ userId: user.id, name: SEED_SECOND_USER.projectName, color: '#10b981' })
    .returning({ id: projects.id })

  await db.insert(tasks).values(
    SEED_SECOND_USER.tasks.map((task, index) => ({
      userId: user.id,
      projectId: project?.id ?? null,
      title: task.title,
      priority: task.priority,
      status: 'TODO' as const,
      dueDate: atOffset(index + 2, 15, now),
    })),
  )

  return { email }
}

async function main() {
  const now = new Date()
  const db = await getDb()

  // Seeding a brand-new database should just work, so make sure the schema is there.
  await runMigrations(db)

  const primary = await seedPrimaryUser(db, now)
  const second = await seedSecondUser(db, now)

  console.log('\nSeed complete.\n')
  console.log(`  ${primary.projects} projects, ${primary.tags} tags, ${primary.tasks} tasks`)
  console.log('\nSign in with:')
  console.log(`  email:    ${DEMO_EMAIL}`)
  console.log(`  password: ${DEMO_PASSWORD}`)
  console.log(`\nA second account (${second.email} / ${SEED_SECOND_USER.password}) holds separate data,`)
  console.log('so you can verify that one user never sees another user\'s tasks.\n')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nSeeding failed:\n')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
