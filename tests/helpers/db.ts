import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

import { __setDatabaseForTesting, type Database } from '@/db'
import { runMigrations } from '@/db/migrator'
import * as schema from '@/db/schema'

/**
 * Each test file gets its own PostgreSQL instance.
 *
 * PGlite is the real PostgreSQL engine compiled to WASM, so these are genuine
 * integration tests: real SQL, real constraints, real enum ordering, real
 * `count(*) filter (...)`. Passing no data directory keeps it purely in memory,
 * so nothing is left on disk and files cannot interfere with one another.
 */
export type TestDatabase = {
  db: Database
  reset: () => Promise<void>
  close: () => Promise<void>
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite()
  const db = drizzle(client, { schema })

  await runMigrations(db)

  // Point the application's `getDb()` at this instance, so anything that
  // resolves the database itself (route handlers, services) uses it too.
  __setDatabaseForTesting(db)

  return {
    db,
    async reset() {
      // Truncating users cascades through every owned table.
      await client.exec('TRUNCATE TABLE users RESTART IDENTITY CASCADE')
    },
    async close() {
      __setDatabaseForTesting(undefined)
      await client.close()
    },
  }
}
