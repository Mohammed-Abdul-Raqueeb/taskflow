import { and, asc, desc, eq, gte, isNotNull, lt, lte, ne, sql, type SQL } from 'drizzle-orm'

import type { Database } from '@/db'
import { projects, tasks } from '@/db/schema'
import { addDaysInZone, endOfDayInZone, startOfDayInZone, startOfWeekInZone, toDateKey } from '@/lib/date'
import { loadTagsForTasks, serializeTask, taskSelection } from '@/lib/services/tasks'
import type {
  CountByPriority,
  CountByStatus,
  DashboardStats,
  ProjectBreakdown,
  TaskDTO,
  TrendPoint,
} from '@/types'

/**
 * Dashboard metrics.
 *
 * Everything here is derived from the database at request time -- nothing is
 * cached, stored denormalised, or hard-coded. Counters come from a single
 * aggregate pass using FILTER clauses, so the whole headline block costs one
 * query rather than one query per tile.
 */

const TREND_DAYS = 14
const LIST_LIMIT = 5

type StatsContext = {
  timeZone: string
  now?: Date
  weekStartsOn?: number
}

async function loadTaskList(
  db: Database,
  where: SQL | undefined,
  orderBy: SQL[],
  limit: number,
): Promise<TaskDTO[]> {
  const rows = await db
    .select(taskSelection)
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)

  const tagMap = await loadTagsForTasks(db, rows.map((row) => row.id))
  return rows.map((row) => serializeTask(row, tagMap.get(row.id) ?? []))
}

export async function getDashboardStats(
  db: Database,
  userId: string,
  context: StatsContext,
): Promise<DashboardStats> {
  const now = context.now ?? new Date()
  const { timeZone } = context
  const weekStartsOn = context.weekStartsOn ?? 1

  const todayStart = startOfDayInZone(now, timeZone)
  const todayEnd = endOfDayInZone(now, timeZone)
  const weekStart = startOfWeekInZone(now, timeZone, weekStartsOn)
  const weekEnd = endOfDayInZone(addDaysInZone(weekStart, 6, timeZone), timeZone)
  const trendStart = startOfDayInZone(addDaysInZone(now, -(TREND_DAYS - 1), timeZone), timeZone)

  const ownedByUser = eq(tasks.userId, userId)
  const incomplete = ne(tasks.status, 'COMPLETED')

  const countOf = (condition: SQL | undefined) =>
    sql<number>`count(*) filter (where ${condition ?? sql`true`})`.mapWith(Number)

  const [summaryRows, projectRows, createdRows, completedRows, recentTasks, upcomingTasks, overdueTasks] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`.mapWith(Number),
          completed: countOf(eq(tasks.status, 'COMPLETED')),
          todo: countOf(eq(tasks.status, 'TODO')),
          inProgress: countOf(eq(tasks.status, 'IN_PROGRESS')),
          low: countOf(eq(tasks.priority, 'LOW')),
          medium: countOf(eq(tasks.priority, 'MEDIUM')),
          high: countOf(eq(tasks.priority, 'HIGH')),
          urgent: countOf(eq(tasks.priority, 'URGENT')),
          overdue: countOf(and(incomplete, isNotNull(tasks.dueDate), lt(tasks.dueDate, now))),
          dueToday: countOf(and(gte(tasks.dueDate, todayStart), lte(tasks.dueDate, todayEnd))),
          dueThisWeek: countOf(and(gte(tasks.dueDate, weekStart), lte(tasks.dueDate, weekEnd))),
          highPriority: countOf(
            and(incomplete, sql`${tasks.priority} in ('HIGH', 'URGENT')`),
          ),
        })
        .from(tasks)
        .where(ownedByUser),

      db
        .select({
          projectId: tasks.projectId,
          name: projects.name,
          color: projects.color,
          total: sql<number>`count(*)`.mapWith(Number),
          completed: countOf(eq(tasks.status, 'COMPLETED')),
        })
        .from(tasks)
        .leftJoin(projects, eq(projects.id, tasks.projectId))
        .where(ownedByUser)
        .groupBy(tasks.projectId, projects.name, projects.color)
        .orderBy(desc(sql`count(*)`)),

      db
        .select({ at: tasks.createdAt })
        .from(tasks)
        .where(and(ownedByUser, gte(tasks.createdAt, trendStart))),

      db
        .select({ at: tasks.completedAt })
        .from(tasks)
        .where(and(ownedByUser, isNotNull(tasks.completedAt), gte(tasks.completedAt, trendStart))),

      loadTaskList(db, and(ownedByUser), [desc(tasks.createdAt), asc(tasks.id)], LIST_LIMIT),

      loadTaskList(
        db,
        and(ownedByUser, incomplete, isNotNull(tasks.dueDate), gte(tasks.dueDate, now)),
        [asc(tasks.dueDate), asc(tasks.id)],
        LIST_LIMIT,
      ),

      loadTaskList(
        db,
        and(ownedByUser, incomplete, isNotNull(tasks.dueDate), lt(tasks.dueDate, now)),
        [asc(tasks.dueDate), asc(tasks.id)],
        LIST_LIMIT,
      ),
    ])

  const summary = summaryRows[0] ?? {
    total: 0,
    completed: 0,
    todo: 0,
    inProgress: 0,
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
    highPriority: 0,
  }

  const byStatus: CountByStatus = {
    TODO: summary.todo,
    IN_PROGRESS: summary.inProgress,
    COMPLETED: summary.completed,
  }

  const byPriority: CountByPriority = {
    LOW: summary.low,
    MEDIUM: summary.medium,
    HIGH: summary.high,
    URGENT: summary.urgent,
  }

  const byProject: ProjectBreakdown[] = projectRows.map((row) => ({
    projectId: row.projectId,
    name: row.name ?? 'No project',
    color: row.color ?? '#94a3b8',
    total: row.total,
    completed: row.completed,
  }))

  // Bucketing runs in JS against the viewer's zone so that the day boundaries
  // match the rest of the dashboard exactly.
  const trend: TrendPoint[] = []
  const buckets = new Map<string, TrendPoint>()
  for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const key = toDateKey(addDaysInZone(now, -offset, timeZone), timeZone)
    const point: TrendPoint = { date: key, created: 0, completed: 0 }
    buckets.set(key, point)
    trend.push(point)
  }
  for (const row of createdRows) {
    const point = buckets.get(toDateKey(row.at, timeZone))
    if (point) point.created += 1
  }
  for (const row of completedRows) {
    if (!row.at) continue
    const point = buckets.get(toDateKey(row.at, timeZone))
    if (point) point.completed += 1
  }

  const pending = summary.total - summary.completed

  return {
    total: summary.total,
    completed: summary.completed,
    pending,
    overdue: summary.overdue,
    dueToday: summary.dueToday,
    dueThisWeek: summary.dueThisWeek,
    highPriority: summary.highPriority,
    completionRate: summary.total === 0 ? 0 : Math.round((summary.completed / summary.total) * 100),
    byStatus,
    byPriority,
    byProject,
    trend,
    recentTasks,
    upcomingTasks,
    overdueTasks,
  }
}
