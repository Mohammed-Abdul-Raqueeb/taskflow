import type { TaskPriority, TaskStatus, ThemePreference } from '@/db/schema'
import type { DueFilter, SortDirection, SortField } from '@/lib/constants'

export type { TaskPriority, TaskStatus, ThemePreference }

/**
 * Wire shapes.
 *
 * Every timestamp crosses the network as an ISO-8601 string so that the same
 * object can be produced by a Server Component, embedded in HTML, and re-parsed
 * on the client without a serialisation boundary in the middle.
 */

export type TagDTO = {
  id: string
  name: string
  color: string
  taskCount?: number
}

export type ProjectSummaryDTO = {
  id: string
  name: string
  color: string
}

export type TaskDTO = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  reminderAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  project: ProjectSummaryDTO | null
  tags: TagDTO[]
}

export type ProjectDTO = {
  id: string
  name: string
  description: string | null
  color: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
  taskCount: number
  completedCount: number
  /** 0-100, rounded. 0 when the project has no tasks. */
  progress: number
}

export type UserDTO = {
  id: string
  email: string
  name: string
  avatarColor: string
  createdAt: string
}

export type UserSettingsDTO = {
  theme: ThemePreference
  emailNotifications: boolean
  dueDateReminders: boolean
  weeklyDigest: boolean
  weekStartsOn: number
  defaultTaskView: string
}

export type TaskListQuery = {
  search?: string
  status?: TaskStatus[]
  priority?: TaskPriority[]
  projectId?: string | 'none'
  tagIds?: string[]
  due?: DueFilter
  sort?: SortField
  direction?: SortDirection
  page?: number
  pageSize?: number
}

export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CountByPriority = Record<TaskPriority, number>
export type CountByStatus = Record<TaskStatus, number>

export type ProjectBreakdown = {
  projectId: string | null
  name: string
  color: string
  total: number
  completed: number
}

export type TrendPoint = {
  /** yyyy-MM-dd in the viewer's time zone. */
  date: string
  created: number
  completed: number
}

export type DashboardStats = {
  total: number
  completed: number
  pending: number
  overdue: number
  dueToday: number
  dueThisWeek: number
  highPriority: number
  completionRate: number
  byStatus: CountByStatus
  byPriority: CountByPriority
  byProject: ProjectBreakdown[]
  trend: TrendPoint[]
  recentTasks: TaskDTO[]
  upcomingTasks: TaskDTO[]
  overdueTasks: TaskDTO[]
}

export type ApiError = {
  error: {
    message: string
    code: string
    /** Present for 422s: field name -> first message. */
    fields?: Record<string, string>
  }
}
