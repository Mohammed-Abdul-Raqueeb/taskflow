import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

/**
 * drizzle-kit only needs `dialect` + `schema` + `out` to generate SQL migrations,
 * so `npm run db:generate` works with no database configured at all.
 * `dbCredentials` is only consulted by commands that talk to a live server
 * (studio/push), which are opt-in.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/taskflow',
  },
  strict: true,
  verbose: true,
})
