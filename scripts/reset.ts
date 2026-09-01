import 'dotenv/config'

import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'

import { getDb } from '../src/db'
import { runMigrations } from '../src/db/migrator'
import { driverKind, pgliteDataDir } from '../src/lib/env'

/**
 * Drops every table and re-applies the migrations from scratch.
 *
 * For the embedded PGlite database this simply deletes the data directory,
 * which is faster and leaves nothing behind.
 */
async function main() {
  if (driverKind === 'pglite') {
    const dir = resolve(process.cwd(), pgliteDataDir)
    rmSync(dir, { recursive: true, force: true })
    console.log(`Removed ${pgliteDataDir}`)
  } else {
    const db = await getDb()
    console.log('Dropping the public schema on the configured PostgreSQL server...')
    await db.execute(sql`drop schema public cascade`)
    await db.execute(sql`create schema public`)
  }

  const db = await getDb()
  await runMigrations(db)
  console.log('Schema recreated. Run `npm run db:seed` to load demo data.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nReset failed:\n')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
