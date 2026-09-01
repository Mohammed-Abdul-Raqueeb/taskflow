import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and purpose-built for password storage, and shipping
 * with Node means no native module to compile per platform. Parameters are
 * recorded inside the digest so they can be raised later without invalidating
 * existing hashes.
 */

const SCRYPT_COST = 16_384 // N
const SCRYPT_BLOCK_SIZE = 8 // r
const SCRYPT_PARALLELISM = 1 // p
const KEY_LENGTH = 64
const SALT_LENGTH = 16
// scrypt needs roughly 128 * N * r bytes; give it headroom over the 32 MB default.
const MAX_MEMORY = 96 * 1024 * 1024

function scrypt(password: string, salt: Buffer, cost: number, blockSize: number, parallelism: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelism, maxmem: MAX_MEMORY },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password, salt, SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM)
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, costRaw, blockRaw, parallelRaw, saltRaw, digestRaw] = parts
  const cost = Number(costRaw)
  const blockSize = Number(blockRaw)
  const parallelism = Number(parallelRaw)
  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) return false

  let expected: Buffer
  try {
    expected = Buffer.from(digestRaw!, 'base64')
  } catch {
    return false
  }
  if (expected.length !== KEY_LENGTH) return false

  const salt = Buffer.from(saltRaw!, 'base64')
  const actual = await scrypt(password, salt, cost, blockSize, parallelism)
  return timingSafeEqual(actual, expected)
}

/**
 * Burns a comparable amount of CPU when no account matches, so that response
 * time does not reveal whether an email address is registered.
 */
const DUMMY_HASH_PROMISE = hashPassword('taskflow-timing-equaliser')

export async function equaliseFailedLoginTiming(password: string): Promise<void> {
  try {
    await verifyPassword(password, await DUMMY_HASH_PROMISE)
  } catch {
    // Timing padding only; a failure here must never change the outcome.
  }
}
