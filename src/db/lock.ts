import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * PGlite stores its cluster in a plain directory and has no inter-process
 * locking of its own. Two processes opening the same directory (a running
 * `next dev` plus `npm run db:seed`, say) would corrupt it, so we take a small
 * advisory lock and fail with an explanation instead.
 *
 * This only applies to the PGlite fallback. A real PostgreSQL server handles
 * concurrency itself and never reaches this code.
 */

const LOCK_FILE = '.taskflow-lock'

type LockPayload = { pid: number; startedAt: string }

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 performs an existence/permission check without delivering a signal.
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // EPERM means the process exists but belongs to another user.
    return code === 'EPERM'
  }
}

export function acquireDataDirLock(dataDir: string): void {
  const dir = resolve(/* turbopackIgnore: true */ process.cwd(), dataDir)
  mkdirSync(dir, { recursive: true })

  const lockPath = join(dir, LOCK_FILE)

  if (existsSync(lockPath)) {
    let holder: LockPayload | null = null
    try {
      holder = JSON.parse(readFileSync(lockPath, 'utf8')) as LockPayload
    } catch {
      holder = null
    }

    if (holder && holder.pid !== process.pid && isProcessAlive(holder.pid)) {
      throw new Error(
        `The local PGlite database at "${dataDir}" is already open by process ${holder.pid} ` +
          `(since ${holder.startedAt}).\n` +
          'Stop the other process (usually a running `npm run dev`) and try again.\n' +
          `If no such process exists, delete ${join(dataDir, LOCK_FILE)} and retry.`,
      )
    }
  }

  const payload: LockPayload = { pid: process.pid, startedAt: new Date().toISOString() }
  writeFileSync(lockPath, JSON.stringify(payload), 'utf8')

  const release = () => releaseDataDirLock(dataDir)
  process.once('exit', release)
  process.once('SIGINT', () => {
    release()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    release()
    process.exit(143)
  })
}

export function releaseDataDirLock(dataDir: string): void {
  const lockPath = join(resolve(/* turbopackIgnore: true */ process.cwd(), dataDir), LOCK_FILE)
  try {
    if (!existsSync(lockPath)) return
    const holder = JSON.parse(readFileSync(lockPath, 'utf8')) as LockPayload
    if (holder.pid === process.pid) rmSync(lockPath, { force: true })
  } catch {
    // A best-effort release: never let cleanup crash a shutting-down process.
  }
}
