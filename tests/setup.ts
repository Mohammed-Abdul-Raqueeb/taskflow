/**
 * A fixed secret keeps session-token HMACs stable inside a run and silences the
 * development-fallback warning. It is test-only and never used elsewhere.
 */
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-value-for-vitest-only-0123456789'

// Force the embedded PGlite driver even if the developer has a DATABASE_URL in
// their shell, so `npm test` never touches a real database.
process.env.DATABASE_URL = ''
