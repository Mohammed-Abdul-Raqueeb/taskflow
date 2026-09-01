import { describe, expect, it } from 'vitest'

import { ValidationError } from '@/lib/errors'
import {
  createProjectSchema,
  createTaskSchema,
  parseOrThrow,
  searchParamsToObject,
  signUpSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '@/lib/validation'

/**
 * The server never trusts the client's own validation, so these cases stand in
 * for hand-crafted requests as much as for typos in the form.
 */

describe('sign-up input', () => {
  it('normalises the email and trims the name', () => {
    const parsed = parseOrThrow(signUpSchema, {
      name: '  Ada Lovelace  ',
      email: '  ADA@Example.COM ',
      password: 'a good password',
    })

    expect(parsed).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'a good password',
    })
  })

  it('rejects a short password and a malformed email, reporting each field', () => {
    const error = (() => {
      try {
        parseOrThrow(signUpSchema, { name: '', email: 'nope', password: 'short' })
      } catch (thrown) {
        return thrown as ValidationError
      }
    })()

    expect(error).toBeInstanceOf(ValidationError)
    expect(error?.status).toBe(422)
    expect(Object.keys(error?.fields ?? {}).sort()).toEqual(['email', 'name', 'password'])
  })
})

describe('task input', () => {
  it('applies defaults for everything but the title', () => {
    const parsed = parseOrThrow(createTaskSchema, { title: 'Only a title' })

    expect(parsed).toMatchObject({
      title: 'Only a title',
      status: 'TODO',
      priority: 'MEDIUM',
      description: null,
      dueDate: null,
      reminderAt: null,
      projectId: null,
      tags: [],
    })
  })

  it('requires a title', () => {
    expect(() => parseOrThrow(createTaskSchema, { title: '   ' })).toThrow(ValidationError)
    expect(() => parseOrThrow(createTaskSchema, {})).toThrow(ValidationError)
  })

  it('rejects an unknown status or priority', () => {
    expect(() => parseOrThrow(createTaskSchema, { title: 'x', status: 'DONE' })).toThrow(ValidationError)
    expect(() => parseOrThrow(createTaskSchema, { title: 'x', priority: 'CRITICAL' })).toThrow(
      ValidationError,
    )
  })

  it('turns an empty string date into null', () => {
    const parsed = parseOrThrow(createTaskSchema, { title: 'x', dueDate: '', reminderAt: null })
    expect(parsed.dueDate).toBeNull()
    expect(parsed.reminderAt).toBeNull()
  })

  it('rejects a due date that is not an ISO instant', () => {
    expect(() => parseOrThrow(createTaskSchema, { title: 'x', dueDate: 'next tuesday' })).toThrow(
      ValidationError,
    )
  })

  it('rejects a reminder set after the due date', () => {
    expect(() =>
      parseOrThrow(createTaskSchema, {
        title: 'x',
        dueDate: '2026-03-01T10:00:00.000Z',
        reminderAt: '2026-03-02T10:00:00.000Z',
      }),
    ).toThrow(ValidationError)
  })

  it('caps the number of tags', () => {
    const tags = Array.from({ length: 13 }, (_, index) => `tag-${index}`)
    expect(() => parseOrThrow(createTaskSchema, { title: 'x', tags })).toThrow(ValidationError)
  })

  it('rejects an over-long title', () => {
    expect(() => parseOrThrow(createTaskSchema, { title: 'a'.repeat(201) })).toThrow(ValidationError)
  })

  it('rejects a project id that is not a uuid', () => {
    expect(() => parseOrThrow(createTaskSchema, { title: 'x', projectId: 'abc' })).toThrow(
      ValidationError,
    )
  })

  it('rejects an update with no fields at all', () => {
    expect(() => parseOrThrow(updateTaskSchema, {})).toThrow(ValidationError)
  })
})

describe('project input', () => {
  it('rejects a colour that is not a 6-digit hex value', () => {
    expect(() => parseOrThrow(createProjectSchema, { name: 'x', color: 'red' })).toThrow(ValidationError)
    expect(() => parseOrThrow(createProjectSchema, { name: 'x', color: '#fff' })).toThrow(ValidationError)
    expect(parseOrThrow(createProjectSchema, { name: 'x', color: '#0EA5E9' }).color).toBe('#0EA5E9')
  })
})

describe('task list query', () => {
  it('reads repeated and comma-separated values alike', () => {
    const repeated = parseOrThrow(
      taskQuerySchema,
      searchParamsToObject(new URLSearchParams('status=TODO&status=COMPLETED')),
    )
    const csv = parseOrThrow(
      taskQuerySchema,
      searchParamsToObject(new URLSearchParams('status=TODO,COMPLETED')),
    )

    expect(repeated.status).toEqual(['TODO', 'COMPLETED'])
    expect(csv.status).toEqual(['TODO', 'COMPLETED'])
  })

  it('coerces page numbers and enforces the page-size ceiling', () => {
    const parsed = parseOrThrow(
      taskQuerySchema,
      searchParamsToObject(new URLSearchParams('page=3&pageSize=25')),
    )
    expect(parsed).toMatchObject({ page: 3, pageSize: 25 })

    expect(() =>
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('pageSize=5000'))),
    ).toThrow(ValidationError)

    expect(() =>
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('page=0'))),
    ).toThrow(ValidationError)
  })

  it('rejects an unknown status, sort field or due filter', () => {
    expect(() =>
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('status=NOPE'))),
    ).toThrow(ValidationError)

    expect(() =>
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('sort=password'))),
    ).toThrow(ValidationError)

    expect(() =>
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('due=someday'))),
    ).toThrow(ValidationError)
  })

  it('accepts "none" as a project filter but rejects other non-uuid values', () => {
    expect(
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('projectId=none')))
        .projectId,
    ).toBe('none')

    expect(() =>
      parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('projectId=1'))),
    ).toThrow(ValidationError)
  })

  it('treats a blank search as absent and caps its length', () => {
    const blank = parseOrThrow(taskQuerySchema, searchParamsToObject(new URLSearchParams('search=  ')))
    expect(blank.search).toBeUndefined()

    const long = parseOrThrow(
      taskQuerySchema,
      searchParamsToObject(new URLSearchParams(`search=${'a'.repeat(500)}`)),
    )
    expect(long.search).toHaveLength(200)
  })
})
