import type { PgliteDatabase } from 'drizzle-orm/pglite'

import { databaseUrl, driverKind, isProduction, pgliteDataDir } from '@/lib/env'
import * as schema from './schema'

/**
 * The single database type used across the app.
 *
 * Both supported drivers (postgres-js against a real PostgreSQL server, and
 * PGlite against an embedded one) expose the exact same Drizzle API surface, so
 * the app is written against one type and the postgres-js handle is widened to
 * it at the single construction site below.
 *
 * This module intentionally does NOT import `server-only`: the migrate and seed
 * scripts run it under plain Node. Client Components must never import it.
 */
export type Database = PgliteDatabase<typeof schema>

export { schema }

declare global {
  // Reused across HMR reloads in development so `next dev` does not open a new
  // database connection on every file change.
  var __taskflowDb: Promise<Database> | undefined
}

async function createDatabase(): Promise<Database> {
  if (driverKind === 'postgres') {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import('postgres'),
      import('drizzle-orm/postgres-js'),
    ])

    const client = postgres(databaseUrl!, {
      // Poolers such as Neon's and PgBouncer do not support named prepared
      // statements in transaction mode.
      prepare: false,
      max: isProduction ? 5 : 10,
      idle_timeout: 20,
      connect_timeout: 15,
    })

    return drizzle(client, { schema }) as unknown as Database
  }

  const [{ PGlite }, { drizzle }, { acquireDataDirLock }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('./lock'),
  ])

  acquireDataDirLock(pgliteDataDir)
  const client = new PGlite(pgliteDataDir)
  return drizzle(client, { schema })
}

/**
 * Lazily opens (and then reuses) the database handle.
 *
 * Deliberately async: it lets the driver actually in use be the only one
 * loaded, and every caller -- route handler, Server Component, script -- is
 * already async.
 */
export function getDb(): Promise<Database> {
  if (!globalThis.__taskflowDb) {
    globalThis.__taskflowDb = createDatabase().catch((error) => {
      // Do not cache a failed connection; the next call should retry.
      globalThis.__taskflowDb = undefined
      throw error
    })
  }
  return globalThis.__taskflowDb
}

/**
 * Test seam. `tests/helpers/db.ts` injects a throwaway in-memory PGlite
 * instance so service code exercises the real query builder against real
 * PostgreSQL without touching the developer's data directory.
 */
export function __setDatabaseForTesting(db: Database | undefined): void {
  globalThis.__taskflowDb = db ? Promise.resolve(db) : undefined
}
