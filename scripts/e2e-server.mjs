import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Boots the app for the end-to-end suite against a database of its own.
 *
 * The dev database and the E2E database are separate directories, so running
 * `npm run test:e2e` never touches the data you have been clicking around in.
 *
 * Reset and seed run as child processes that exit before the server starts:
 * PGlite has no inter-process locking, so only one process may hold a data
 * directory at a time (see src/db/lock.ts).
 *
 * The suite runs against a production build rather than `next dev`, so it
 * exercises the bundle that actually ships -- and is not fighting the dev
 * overlay that `next dev` injects into every page.
 */

const PORT = process.env.E2E_PORT ?? '3210'
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? '.pglite-e2e'

const env = {
  ...process.env,
  PGLITE_DATA_DIR: DATA_DIR,
  DATABASE_URL: '',
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-secret-value-not-used-anywhere-else-0123456789',
  NEXT_TELEMETRY_DISABLED: '1',
}

function run(command, label) {
  const result = spawnSync(command, { stdio: 'inherit', shell: true, env })
  if (result.status !== 0) {
    console.error(`[e2e] ${label} failed with exit code ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

// A clean slate every run, so tests never inherit state from the last one.
rmSync(resolve(process.cwd(), DATA_DIR), { recursive: true, force: true })

console.log(`[e2e] Preparing ${DATA_DIR}...`)
run('npx tsx scripts/migrate.ts', 'migrate')
run('npx tsx scripts/seed.ts', 'seed')

console.log('[e2e] Building...')
run('npx next build', 'build')

console.log(`[e2e] Starting Next.js on port ${PORT}`)
const server = spawn(`npx next start --port ${PORT}`, {
  stdio: 'inherit',
  shell: true,
  env: { ...env, NODE_ENV: 'production' },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.kill()
    process.exit(0)
  })
}

server.on('exit', (code) => process.exit(code ?? 0))
