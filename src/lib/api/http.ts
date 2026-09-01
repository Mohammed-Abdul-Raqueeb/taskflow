import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { AppError, ValidationError, isAppError } from '@/lib/errors'
import type { ApiError } from '@/types'

/**
 * The single place where a thrown error becomes an HTTP response.
 *
 * Known, user-facing failures keep their message and status. Anything else is
 * logged server-side and reported as a generic 500 -- stack traces, SQL and
 * driver internals never cross the wire.
 */

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init)
}

export function jsonCreated<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 })
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function toApiError(error: unknown): { body: ApiError; status: number } {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: { error: { message: error.message, code: error.code, fields: error.fields } },
    }
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : '_'
      if (!(key in fields)) fields[key] = issue.message
    }
    const validation = new ValidationError('Please check the highlighted fields.', fields)
    return {
      status: validation.status,
      body: { error: { message: validation.message, code: validation.code, fields } },
    }
  }

  console.error('[taskflow] Unhandled server error:', error)
  return {
    status: 500,
    body: {
      error: {
        message: 'Something went wrong on our end. Please try again.',
        code: 'INTERNAL_ERROR',
      },
    },
  }
}

export function jsonError(error: unknown): NextResponse<ApiError> {
  const { body, status } = toApiError(error)
  return NextResponse.json(body, { status })
}

/**
 * Wraps a Route Handler so every failure -- expected or not -- becomes a
 * well-formed JSON error instead of an unhandled rejection.
 */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      return jsonError(error)
    }
  }
}

/** Reads and parses a JSON body, rejecting malformed payloads with a 422. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text()
    if (!text) return {}
    return JSON.parse(text)
  } catch {
    throw new ValidationError('The request body must be valid JSON.')
  }
}

export { AppError }
