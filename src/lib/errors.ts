/**
 * Application-level errors.
 *
 * Anything thrown by the service layer that a user is allowed to see is one of
 * these. Everything else is treated as an internal failure and reported as a
 * generic 500 -- stack traces and driver messages never reach the browser.
 */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(message: string, options: { status: number; code: string; fields?: Record<string, string> }) {
    super(message)
    this.name = new.target.name
    this.status = options.status
    this.code = options.code
    this.fields = options.fields
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Please check the highlighted fields.', fields?: Record<string, string>) {
    super(message, { status: 422, code: 'VALIDATION_ERROR', fields })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You need to sign in to continue.') {
    super(message, { status: 401, code: 'UNAUTHORIZED' })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.') {
    super(message, { status: 403, code: 'FORBIDDEN' })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found.') {
    super(message, { status: 404, code: 'NOT_FOUND' })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That already exists.', fields?: Record<string, string>) {
    super(message, { status: 409, code: 'CONFLICT', fields })
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many attempts. Please wait a moment and try again.') {
    super(message, { status: 429, code: 'RATE_LIMITED' })
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
