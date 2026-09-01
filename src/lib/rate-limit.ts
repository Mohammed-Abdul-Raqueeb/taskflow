import { RateLimitError } from '@/lib/errors'

/**
 * A small fixed-window limiter for the authentication endpoints.
 *
 * It lives in process memory, which is the honest scope of its protection: it
 * slows down credential stuffing against a single instance and costs nothing to
 * run. A deployment behind several instances should put a shared limiter (Redis,
 * Upstash, the platform's own WAF) in front of it -- see the README.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = 0

function sweep(now: number) {
  // Amortised cleanup so the map cannot grow without bound.
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitOptions = {
  /** Requests allowed inside one window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > options.limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000)
    throw new RateLimitError(`Too many attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`)
  }
}

/** Best-effort client identity from proxy headers, falling back to a shared bucket. */
export function clientKey(request: Request, scope: string): string {
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headers.get('x-real-ip') || headers.get('cf-connecting-ip') || 'unknown'
  return `${scope}:${ip}`
}

export function resetRateLimits(): void {
  buckets.clear()
  lastSweep = 0
}
