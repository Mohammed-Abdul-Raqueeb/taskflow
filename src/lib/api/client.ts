import type {
  ApiError,
  DashboardStats,
  Paginated,
  ProjectDTO,
  TagDTO,
  TaskDTO,
  UserDTO,
  UserSettingsDTO,
} from '@/types'

/**
 * Browser-side API client.
 *
 * Every call funnels through `request`, so the three failure modes a user can
 * hit -- the network being down, a well-formed error from the server, and a
 * response that is not JSON at all -- always arrive as an `ApiRequestError`
 * with a message worth showing.
 */

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(message: string, status: number, code = 'ERROR', fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      // Session cookie is httpOnly; same-origin requests carry it by default,
      // but being explicit keeps the intent obvious.
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiRequestError(
      'We could not reach the server. Check your connection and try again.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const body = payload as ApiError | null
    throw new ApiRequestError(
      body?.error?.message ?? 'Something went wrong. Please try again.',
      response.status,
      body?.error?.code ?? 'ERROR',
      body?.error?.fields,
    )
  }

  return payload as T
}

const json = (body: unknown) => JSON.stringify(body)

export const api = {
  auth: {
    signUp: (input: { name: string; email: string; password: string }) =>
      request<{ user: UserDTO }>('/api/auth/signup', { method: 'POST', body: json(input) }),
    signIn: (input: { email: string; password: string }) =>
      request<{ user: UserDTO }>('/api/auth/login', { method: 'POST', body: json(input) }),
    signOut: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  },

  tasks: {
    list: (query: string) => request<Paginated<TaskDTO>>(`/api/tasks${query ? `?${query}` : ''}`),
    get: (id: string) => request<{ task: TaskDTO }>(`/api/tasks/${id}`),
    create: (input: unknown) =>
      request<{ task: TaskDTO }>('/api/tasks', { method: 'POST', body: json(input) }),
    update: (id: string, input: unknown) =>
      request<{ task: TaskDTO }>(`/api/tasks/${id}`, { method: 'PATCH', body: json(input) }),
    setCompleted: (id: string, completed: boolean) =>
      request<{ task: TaskDTO }>(`/api/tasks/${id}/complete`, {
        method: 'PATCH',
        body: json({ completed }),
      }),
    remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  },

  projects: {
    list: (includeArchived = false) =>
      request<{ projects: ProjectDTO[] }>(
        `/api/projects${includeArchived ? '?includeArchived=true' : ''}`,
      ),
    create: (input: unknown) =>
      request<{ project: ProjectDTO }>('/api/projects', { method: 'POST', body: json(input) }),
    update: (id: string, input: unknown) =>
      request<{ project: ProjectDTO }>(`/api/projects/${id}`, { method: 'PATCH', body: json(input) }),
    remove: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  tags: {
    list: () => request<{ tags: TagDTO[] }>('/api/tags'),
    create: (input: unknown) =>
      request<{ tag: TagDTO }>('/api/tags', { method: 'POST', body: json(input) }),
    update: (id: string, input: unknown) =>
      request<{ tag: TagDTO }>(`/api/tags/${id}`, { method: 'PATCH', body: json(input) }),
    remove: (id: string) => request<void>(`/api/tags/${id}`, { method: 'DELETE' }),
  },

  stats: {
    get: () => request<{ stats: DashboardStats }>('/api/stats'),
  },

  calendar: {
    range: (from: string, to: string) =>
      request<{ tasks: TaskDTO[] }>(
        `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  },

  settings: {
    get: () => request<{ settings: UserSettingsDTO }>('/api/settings'),
    update: (input: Partial<UserSettingsDTO>) =>
      request<{ settings: UserSettingsDTO }>('/api/settings', { method: 'PATCH', body: json(input) }),
  },

  account: {
    updateProfile: (input: { name: string; email: string; avatarColor?: string }) =>
      request<{ user: UserDTO }>('/api/account', { method: 'PATCH', body: json(input) }),
    changePassword: (input: { currentPassword: string; newPassword: string }) =>
      request<{ ok: true }>('/api/account/password', { method: 'POST', body: json(input) }),
    remove: () => request<void>('/api/account', { method: 'DELETE' }),
  },
}

/** Pulls the field-level messages out of a failure, for inline form errors. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiRequestError ? (error.fields ?? {}) : {}
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
