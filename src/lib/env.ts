import { createHash } from 'node:crypto'

/**
 * Server-side environment access.
 *
 * Nothing in here may be imported from a Client Component: it reads secrets and
 * a bundler that followed such an import would ship them to the browser. Only
 * `NEXT_PUBLIC_*` values are safe on the client, and those are read directly at
 * their use sites.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development'

export const isProduction = NODE_ENV === 'production'
export const isTest = NODE_ENV === 'test' || process.env.VITEST === 'true'

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

/**
 * A PostgreSQL connection string enables the `postgres-js` driver. When it is
 * absent we fall back to PGlite, which is the same PostgreSQL engine compiled
 * to WASM and persisted to disk -- real SQL, real migrations, zero setup.
 */
export const databaseUrl = optional(process.env.DATABASE_URL)

export const pgliteDataDir = optional(process.env.PGLITE_DATA_DIR) ?? '.pglite'

export const driverKind: 'postgres' | 'pglite' = databaseUrl ? 'postgres' : 'pglite'

/**
 * Secret used to derive the HMAC over session tokens.
 *
 * Production must supply a real one. Outside production we derive a stable
 * value from the project identity so that restarting the dev server does not
 * invalidate every existing session, and warn loudly once.
 */
let warnedAboutSecret = false

export function getAuthSecret(): string {
  const configured = optional(process.env.AUTH_SECRET)
  if (configured) {
    if (configured.length < 32) {
      throw new Error('AUTH_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    }
    return configured
  }

  if (isProduction) {
    throw new Error(
      'AUTH_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }

  if (!warnedAboutSecret && !isTest) {
    warnedAboutSecret = true
    console.warn(
      '[taskflow] AUTH_SECRET is not set. Using an insecure development-only fallback. ' +
        'Set AUTH_SECRET in .env.local before deploying.',
    )
  }

  return createHash('sha256').update('taskflow-insecure-dev-secret').digest('hex')
}

export const appUrl = optional(process.env.NEXT_PUBLIC_APP_URL) ?? 'http://localhost:3000'

/** Secure cookies require HTTPS, which local development does not have. */
export const useSecureCookies = isProduction && appUrl.startsWith('https://')
