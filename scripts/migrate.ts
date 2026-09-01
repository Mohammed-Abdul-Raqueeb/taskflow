import 'dotenv/config'

import { getDb } from '../src/db'
import { runMigrations } from '../src/db/migrator'
import { driverKind } from '../src/lib/env'

async function main() {
  const target = driverKind === 'postgres' ? 'PostgreSQL server (DATABASE_URL)' : 'embedded PGlite database'
  console.log(`Applying migrations to the ${target}...`)

  const db = await getDb()
  await runMigrations(db)

  console.log('Migrations applied.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nMigration failed:\n')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
