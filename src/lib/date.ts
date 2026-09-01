/**
 * Time-zone aware day arithmetic.
 *
 * Every timestamp is stored as `timestamptz`, i.e. an absolute instant. But
 * "overdue", "due today" and the calendar grid are *calendar* questions, and
 * their answer depends on the viewer's zone. The client reports its IANA zone
 * in a cookie; these helpers turn that zone plus an instant into the UTC
 * instants that bound the corresponding local day.
 */

const DEFAULT_TIME_ZONE = 'UTC'

export function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function normalizeTimeZone(timeZone: string | undefined | null): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = partsFormatter(timeZone).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some ICU builds render midnight as hour 24 when hour12 is false.
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  }
}

/** Milliseconds to add to a UTC instant to obtain the matching wall-clock time. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // Discard sub-second noise so the offset lands on a whole second.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** The UTC instant at which the given local wall-clock time occurs in `timeZone`. */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  // First approximation using the offset in effect near the target instant,
  // then one correction pass so DST transition days resolve correctly.
  const firstGuess = new Date(naiveUtc - zoneOffsetMs(new Date(naiveUtc), timeZone))
  return new Date(naiveUtc - zoneOffsetMs(firstGuess, timeZone))
}

export function startOfDayInZone(instant: Date, timeZone: string): Date {
  const p = localParts(instant, timeZone)
  return zonedTimeToUtc(timeZone, p.year, p.month, p.day)
}

export function endOfDayInZone(instant: Date, timeZone: string): Date {
  return new Date(addDaysInZone(startOfDayInZone(instant, timeZone), 1, timeZone).getTime() - 1)
}

/** Adds whole calendar days, keeping the local wall-clock time stable across DST. */
export function addDaysInZone(instant: Date, days: number, timeZone: string): Date {
  const p = localParts(instant, timeZone)
  return zonedTimeToUtc(timeZone, p.year, p.month, p.day + days, p.hour, p.minute, p.second)
}

export function startOfWeekInZone(instant: Date, timeZone: string, weekStartsOn = 1): Date {
  const start = startOfDayInZone(instant, timeZone)
  const weekday = new Date(start.getTime() + zoneOffsetMs(start, timeZone)).getUTCDay()
  const diff = (weekday - weekStartsOn + 7) % 7
  return addDaysInZone(start, -diff, timeZone)
}

export function startOfMonthInZone(instant: Date, timeZone: string): Date {
  const p = localParts(instant, timeZone)
  return zonedTimeToUtc(timeZone, p.year, p.month, 1)
}

export function endOfMonthInZone(instant: Date, timeZone: string): Date {
  const p = localParts(instant, timeZone)
  return new Date(zonedTimeToUtc(timeZone, p.year, p.month + 1, 1).getTime() - 1)
}

/** `yyyy-MM-dd` for the local calendar day containing `instant`. */
export function toDateKey(instant: Date, timeZone: string): string {
  const p = localParts(instant, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/* -------------------------------------------------------------------------- */
/*                          Display helpers (client-safe)                     */
/* -------------------------------------------------------------------------- */

export function formatDate(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return '--'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return '--'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date)
}

/** "Today", "Tomorrow", "3 days ago", ... relative to the viewer's calendar. */
export function formatRelativeDay(
  value: string | Date | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): string {
  if (!value) return 'No due date'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return 'No due date'

  const startTarget = startOfDayInZone(date, timeZone).getTime()
  const startNow = startOfDayInZone(now, timeZone).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round((startTarget - startNow) / dayMs)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`
  return formatDate(date, timeZone)
}

export function isOverdue(task: { dueDate: string | null; status: string }, now: Date = new Date()): boolean {
  if (!task.dueDate || task.status === 'COMPLETED') return false
  return new Date(task.dueDate).getTime() < now.getTime()
}

/** Value for an `<input type="datetime-local">`, rendered in the given zone. */
export function toDateTimeLocalValue(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const p = localParts(date, zone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Inverse of {@link toDateTimeLocalValue}. */
export function fromDateTimeLocalValue(value: string, timeZone?: string): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const [, y, mo, d, h, mi] = match
  return zonedTimeToUtc(zone, Number(y), Number(mo), Number(d), Number(h), Number(mi)).toISOString()
}
