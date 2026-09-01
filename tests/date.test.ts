import { describe, expect, it } from 'vitest'

import {
  addDaysInZone,
  endOfDayInZone,
  formatRelativeDay,
  fromDateTimeLocalValue,
  isOverdue,
  normalizeTimeZone,
  startOfDayInZone,
  startOfWeekInZone,
  toDateKey,
  toDateTimeLocalValue,
  zonedTimeToUtc,
} from '@/lib/date'

/**
 * "Overdue" and "due today" are calendar questions, and their answer depends on
 * the viewer's zone. These tests pin that behaviour for zones ahead of and
 * behind UTC, and across a daylight-saving transition.
 */

describe('day boundaries', () => {
  it('resolves the start of the day in the viewer\'s zone', () => {
    // 2026-03-10T02:00Z is still 10pm on 9 March in New York, which by then is
    // on EDT (UTC-4) -- clocks sprang forward on 8 March.
    const instant = new Date('2026-03-10T02:00:00.000Z')

    expect(startOfDayInZone(instant, 'UTC').toISOString()).toBe('2026-03-10T00:00:00.000Z')
    expect(startOfDayInZone(instant, 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z')
    // Tokyo is already on 10 March at 11am.
    expect(startOfDayInZone(instant, 'Asia/Tokyo').toISOString()).toBe('2026-03-09T15:00:00.000Z')
  })

  it('ends the day one millisecond before the next one starts', () => {
    const instant = new Date('2026-06-15T12:00:00.000Z')
    const start = startOfDayInZone(instant, 'Europe/Berlin')
    const end = endOfDayInZone(instant, 'Europe/Berlin')

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })

  it('handles a zone with a half-hour offset', () => {
    const instant = new Date('2026-09-01T20:30:00.000Z')
    // 01:00 on 2 September in Kolkata (UTC+05:30).
    expect(toDateKey(instant, 'Asia/Kolkata')).toBe('2026-09-02')
    expect(startOfDayInZone(instant, 'Asia/Kolkata').toISOString()).toBe('2026-09-01T18:30:00.000Z')
  })

  it('keeps the local wall clock when adding days across a DST change', () => {
    // US clocks spring forward on 8 March 2026.
    const before = zonedTimeToUtc('America/New_York', 2026, 3, 7, 9, 0)
    const after = addDaysInZone(before, 2, 'America/New_York')

    // Still 9am local, even though the elapsed time is 47 hours, not 48.
    expect(toDateKey(after, 'America/New_York')).toBe('2026-03-09')
    expect(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      }).format(after),
    ).toBe('09')
  })

  it('starts the week on the configured day', () => {
    // 2026-09-01 is a Tuesday.
    const instant = new Date('2026-09-01T12:00:00.000Z')

    expect(toDateKey(startOfWeekInZone(instant, 'UTC', 1), 'UTC')).toBe('2026-08-31')
    expect(toDateKey(startOfWeekInZone(instant, 'UTC', 0), 'UTC')).toBe('2026-08-30')
  })

  it('falls back to UTC for an unknown zone', () => {
    expect(normalizeTimeZone('Mars/Olympus_Mons')).toBe('UTC')
    expect(normalizeTimeZone(undefined)).toBe('UTC')
    expect(normalizeTimeZone('Europe/Paris')).toBe('Europe/Paris')
  })
})

describe('datetime-local round trip', () => {
  it('renders and re-parses an instant without drift', () => {
    const iso = '2026-09-01T14:30:00.000Z'
    const zone = 'Europe/Berlin'

    const local = toDateTimeLocalValue(iso, zone)
    expect(local).toBe('2026-09-01T16:30')

    expect(fromDateTimeLocalValue(local, zone)).toBe(iso)
  })

  it('returns null for an empty or malformed value', () => {
    expect(fromDateTimeLocalValue('', 'UTC')).toBeNull()
    expect(fromDateTimeLocalValue('not a date', 'UTC')).toBeNull()
    expect(toDateTimeLocalValue(null)).toBe('')
  })
})

describe('overdue and relative wording', () => {
  const now = new Date('2026-09-01T12:00:00.000Z')

  it('treats a past due date on an open task as overdue', () => {
    expect(isOverdue({ dueDate: '2026-08-31T12:00:00.000Z', status: 'TODO' }, now)).toBe(true)
    expect(isOverdue({ dueDate: '2026-09-02T12:00:00.000Z', status: 'TODO' }, now)).toBe(false)
  })

  it('never treats a completed task as overdue', () => {
    expect(isOverdue({ dueDate: '2026-08-01T12:00:00.000Z', status: 'COMPLETED' }, now)).toBe(false)
  })

  it('never treats a task without a due date as overdue', () => {
    expect(isOverdue({ dueDate: null, status: 'TODO' }, now)).toBe(false)
  })

  it('describes nearby days in words', () => {
    expect(formatRelativeDay('2026-09-01T23:00:00.000Z', 'UTC', now)).toBe('Today')
    expect(formatRelativeDay('2026-09-02T01:00:00.000Z', 'UTC', now)).toBe('Tomorrow')
    expect(formatRelativeDay('2026-08-31T23:00:00.000Z', 'UTC', now)).toBe('Yesterday')
    expect(formatRelativeDay('2026-09-04T09:00:00.000Z', 'UTC', now)).toBe('In 3 days')
    expect(formatRelativeDay('2026-08-29T09:00:00.000Z', 'UTC', now)).toBe('3 days ago')
    expect(formatRelativeDay(null, 'UTC', now)).toBe('No due date')
  })

  it('answers "today" according to the viewer\'s zone, not the server\'s', () => {
    // 23:00 UTC on 1 September is already 2 September in Tokyo.
    const instant = '2026-09-01T23:00:00.000Z'
    expect(formatRelativeDay(instant, 'UTC', now)).toBe('Today')
    expect(formatRelativeDay(instant, 'Asia/Tokyo', now)).toBe('Tomorrow')
  })
})
