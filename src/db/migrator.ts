import { resolve } from 'node:path'

import { driverKind } from '@/lib/env'
import type { Database } from './index'

/**
 * Applies every pending migration in `drizzle/`.
 *
 * The same SQL runs against both supported drivers -- PGlite is PostgreSQL, so
 * there is no dialect drift between local development and production.
 */
export async function runMigrations(db: Database, migrationsFolder = resolve(process.cwd(), 'drizzle')) {
  if (driverKind === 'postgres') {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator')
    type PostgresMigrateDb = Parameters<typeof migrate>[0]
    await migrate(db as unknown as PostgresMigrateDb, { migrationsFolder })
    return
  }

  const { migrate } = await import('drizzle-orm/pglite/migrator')
  await migrate(db, { migrationsFolder })
}
