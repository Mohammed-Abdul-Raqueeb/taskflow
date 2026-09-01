# TaskFlow

A task manager for people juggling several projects: priorities, due dates,
tags, a calendar, and a dashboard whose numbers are computed from the database
on every request.

Built as a real, server-authoritative product rather than a UI shell — every
button in the interface performs an actual database operation, and every figure
on the dashboard is derived from a query.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Commands](#commands)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Database schema](#database-schema)
- [Architecture notes](#architecture-notes)
- [Security](#security)
- [Deployment](#deployment)

---

## Features

**Tasks**
- Create, read, update and delete, with a confirmation step before any deletion
- Title, description, status, priority, due date, optional reminder, project, tags
- One-click complete/reopen from the list, applied optimistically
- `completedAt` is derived from status by the server, never sent by the client

**Finding things**
- Debounced search across title, description, project name *and* tag name
- Filter by status, priority, project (including "no project"), tags and due-date window
- Sort by due date, priority, created, updated, title or status, in either direction
- Server-side pagination with a stable tiebreak, so pages never repeat a row
- All of it lives in the URL, so a filtered view is shareable and survives a refresh

**Projects**
- Create, edit, archive and delete; per-project progress and task counts
- Deleting a project keeps its tasks and moves them to "No project"
- Case-insensitive unique names, scoped per user

**Tags**
- Created on the fly by typing them on a task, de-duplicated case-insensitively
- Renamed, recoloured or deleted from Settings; a rename applies everywhere at once

**Dashboard**
- Total, completed, pending, overdue, due today, due this week, high priority, completion rate
- Breakdowns by status, priority and project
- A 14-day created-vs-completed activity chart
- Overdue, upcoming and recently added lists
- Every tile links through to the task list with the matching filter applied

**Calendar**
- Month grid with prev/next/today, tasks placed on their due day
- Click a day to see its tasks; click a task for its details
- A genuinely different layout on phones: dots in the grid, detail in a panel below

**Settings**
- Profile (name, email, avatar colour), password change, tag management
- Light / dark / system theme, week start day
- Notification preferences
- Account deletion, which cascades to everything the account owns

**Throughout**
- Light and dark themes, chosen server-side from a cookie so there is no flash
- Responsive layouts: bottom tab bar on phones, icon rail on tablets, full sidebar on desktop
- Loading skeletons, empty states, error states, toasts, and accessible dialogs and menus

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 6 (strict) |
| UI | React 19, Tailwind CSS v4, Lucide icons |
| Components | Hand-built accessible primitives (no component library) |
| Database | PostgreSQL |
| ORM | Drizzle ORM + drizzle-kit migrations |
| Validation | Zod 4, shared by client and server |
| Auth | Custom session auth: scrypt hashes, HMAC'd session tokens, httpOnly cookies |
| Charts | Inline SVG, server-rendered |
| Unit / integration tests | Vitest against real PostgreSQL (PGlite) |
| End-to-end tests | Playwright against a production build |

---

## Requirements

- **Node.js 20.9+** (developed on 22.20)
- **npm 10+**
- **PostgreSQL** — optional. With no `DATABASE_URL` the app runs on an embedded
  PostgreSQL (PGlite) persisted to `./.pglite`, which needs no installation.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # optional: the defaults work as-is
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000> and sign in with:

| Email | Password |
| --- | --- |
| `demo@taskflow.app` | `demo1234` |
| `alex@taskflow.app` | `demo1234` |

The second account holds separate data, so you can confirm by hand that one
user never sees another's tasks.

> **One process at a time.** The embedded database is a directory, not a server,
> so only one process may hold it. Stop `npm run dev` before running
> `db:seed`/`db:migrate`, or point `DATABASE_URL` at a real PostgreSQL server,
> which has no such restriction. You will get a clear error rather than
> corruption if you forget.

---

## Environment variables

Copy `.env.example` to `.env.local`. Every value has a working default for local
development except `AUTH_SECRET` in production.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | *(empty)* | PostgreSQL connection string. Empty selects the embedded PGlite database. |
| `PGLITE_DATA_DIR` | No | `.pglite` | Where the embedded database stores its files. |
| `AUTH_SECRET` | **In production** | dev fallback | 32+ byte secret keying the session-token HMAC. The app refuses to boot in production without it. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public origin; decides whether cookies are marked `Secure`. |
| `SEED_USER_EMAIL` | No | `demo@taskflow.app` | Demo account created by the seed. |
| `SEED_USER_PASSWORD` | No | `demo1234` | Demo account password. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env*` files are git-ignored apart from `.env.example`. No secret is ever read
from a Client Component, so none can reach the browser bundle.

---

## Database

### Local, with no setup

Leave `DATABASE_URL` empty. The app uses [PGlite](https://pglite.dev) — the real
PostgreSQL engine compiled to WebAssembly — persisted to `./.pglite`. The same
SQL and the same migrations run against it as against a server, so there is no
dialect drift between development and production.

### Against a real PostgreSQL server

Set `DATABASE_URL` and the app switches to the `postgres-js` driver:

```bash
DATABASE_URL="postgresql://user:password@host/taskflow?sslmode=require"
```

This is the production path. It works with any PostgreSQL 13+, including
managed services such as Neon, Supabase or RDS. Prepared statements are
disabled so transaction-mode poolers (PgBouncer, Neon's pooler) work.

### Migrations

Migrations are plain SQL under `drizzle/`, generated from `src/db/schema.ts`.

```bash
npm run db:generate    # schema change -> new SQL migration file
npm run db:migrate     # apply pending migrations
npm run db:reset       # drop everything and re-apply from scratch
npm run db:studio      # browse the data in Drizzle Studio
```

### Seed data

```bash
npm run db:seed
```

Creates two accounts with 5 projects, 10 tags and 30 tasks spread across
overdue, due-today, this-week, upcoming, undated and completed. Due dates are
relative to the moment you seed, so the demo always looks current. Re-running it
recreates only the demo accounts and leaves any other account alone.

Seed content lives in `src/db/seed-data.ts`, which nothing in the app imports —
the production UI contains no hard-coded tasks.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` across app, scripts and tests |
| `npm test` | Vitest suite (unit + database integration) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright suite |
| `npm run check` | typecheck + lint + tests, the pre-push gate |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:reset` / `db:studio` | Database tasks |

---

## Testing

### Unit and integration — `npm test`

147 tests across 8 files. These are not mocked: each test file boots its own
in-memory PostgreSQL via PGlite, runs the real migrations, and exercises the
real query builder. Real constraints, real enum ordering, real
`count(*) filter (...)`.

| File | Covers |
| --- | --- |
| `tests/auth.test.ts` | Password hashing, registration, sign-in, sessions, expiry, renewal, password change |
| `tests/tasks.test.ts` | Task CRUD, completion, `completedAt` derivation, tag syncing, pagination |
| `tests/filters.test.ts` | Search across four fields, every filter, every sort, wildcard escaping |
| `tests/projects.test.ts` | Project CRUD, progress maths, delete-keeps-tasks, tag management |
| `tests/authorization.test.ts` | Cross-user isolation on tasks, projects, tags, stats and settings |
| `tests/stats.test.ts` | Every dashboard number, against a known fixture |
| `tests/validation.test.ts` | Schemas, including hand-crafted invalid input |
| `tests/date.test.ts` | Time-zone day boundaries, DST, half-hour offsets |

### End-to-end — `npm run test:e2e`

39 Playwright tests. The harness (`scripts/e2e-server.mjs`) creates its own
database, seeds it, runs `next build`, and serves the result — so the suite
drives the bundle that actually ships, on a database that is never the one you
have been clicking around in.

First run only:

```bash
npx playwright install chromium
```

Projects: `setup` (signs in once), `auth-flows` (drives the real sign-in and
sign-up forms), `desktop` (features), `mobile` (Pixel 7 responsive checks).
Sharing one session keeps the run inside the login rate limit, which stays
switched on rather than being disabled for the tests' convenience.

### Screenshots

`node scripts/screenshots.mjs [baseUrl] [outDir]` captures every page in both
themes at three widths. A development aid, not part of the suite.

---

## Project structure

```
taskflow/
├── drizzle/                     SQL migrations (generated, committed)
│   └── 0000_init.sql
├── e2e/                         Playwright end-to-end tests
│   ├── setup/auth.setup.ts      Signs in once, saves the session
│   ├── auth.spec.ts             Sign-in, sign-up, authorisation
│   ├── tasks.spec.ts            Task CRUD, search, filter, sort, pagination
│   ├── app.spec.ts              Projects, dashboard, calendar, settings
│   ├── responsive.spec.ts       Phone-viewport layout checks
│   └── helpers.ts               Shared locators and actions
├── scripts/
│   ├── migrate.ts               Apply migrations
│   ├── seed.ts                  Idempotent demo seed
│   ├── reset.ts                 Drop and recreate the schema
│   ├── e2e-server.mjs           Isolated build+serve harness for Playwright
│   └── screenshots.mjs          Visual capture helper
├── src/
│   ├── app/
│   │   ├── (auth)/              Signed-out routes: split-panel layout
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (app)/               Signed-in routes, gated by the layout
│   │   │   ├── layout.tsx       Auth gate + sidebar/topbar/tab-bar shell
│   │   │   ├── dashboard/
│   │   │   ├── tasks/           list · new · [id]/edit
│   │   │   ├── projects/        list · [id]
│   │   │   ├── calendar/
│   │   │   ├── settings/
│   │   │   └── error.tsx        Per-page error boundary
│   │   ├── api/                 REST route handlers
│   │   │   ├── auth/            signup · login · logout · session
│   │   │   ├── tasks/           collection · [id] · [id]/complete
│   │   │   ├── projects/        collection · [id]
│   │   │   ├── tags/            collection · [id]
│   │   │   ├── account/         profile · password
│   │   │   ├── calendar/        date-range query
│   │   │   ├── stats/           dashboard metrics
│   │   │   └── settings/
│   │   ├── layout.tsx           Root: theme, toasts, time-zone sync
│   │   ├── globals.css          Design tokens, both themes, motion
│   │   ├── error.tsx            Top-level error boundary
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/                  button · card · badge · field · dialog · menu · toast · states
│   │   ├── layout/              nav · topbar · theme-provider
│   │   ├── auth/                auth-form
│   │   ├── tasks/               task-list · task-form · task-filters
│   │   ├── projects/            project-manager
│   │   ├── dashboard/           charts · stat-card
│   │   ├── calendar/            calendar-view
│   │   └── settings/            settings-panels · tags-panel
│   ├── db/
│   │   ├── schema.ts            Tables, enums, relations, indexes
│   │   ├── index.ts             Driver selection and connection reuse
│   │   ├── migrator.ts          Migration runner for both drivers
│   │   ├── lock.ts              Advisory lock for the embedded database
│   │   └── seed-data.ts         Demo content (never imported by the app)
│   ├── lib/
│   │   ├── auth/                password · session · current-user
│   │   ├── services/            tasks · projects · tags · users · stats
│   │   ├── api/                 http (server) · client (browser)
│   │   ├── validation.ts        Every Zod schema
│   │   ├── date.ts              Time-zone aware day arithmetic
│   │   ├── errors.ts            Typed application errors
│   │   ├── rate-limit.ts        Fixed-window limiter for auth endpoints
│   │   ├── constants.ts         Enums, metadata, palettes
│   │   ├── env.ts               Server-side environment access
│   │   └── utils.ts
│   ├── types/index.ts           Wire shapes shared by client and server
│   └── middleware.ts            Fast redirect for signed-out visitors
└── tests/                       Vitest suites and fixtures
```

Roughly 13,000 lines across 103 TypeScript files, with no file large enough to
be a dumping ground.

---

## Database schema

Seven tables. Every user-owned table carries `user_id`, which is what makes
authorisation a property of the query rather than a check bolted on afterwards.

```
users ──┬── sessions            (token digests, expiry)
        ├── user_settings       (1:1 — theme, notifications, week start)
        ├── projects ──┐
        ├── tags ──────┼─── task_tags ─── tasks
        └── tasks ─────┘
```

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | Accounts | Email stored lower-cased with a unique index, so uniqueness is case-insensitive |
| `sessions` | Server-side sessions | Stores the HMAC of the token, never the token |
| `user_settings` | Per-account preferences | 1:1 with `users`, cascades on delete |
| `projects` | Task grouping | Unique on `(user_id, lower(name))` |
| `tags` | Labels | Unique on `(user_id, lower(name))` |
| `tasks` | The core entity | See below |
| `task_tags` | Many-to-many join | Composite primary key, cascades from both sides |

**`tasks`** holds `id`, `user_id`, `project_id`, `title`, `description`,
`status`, `priority`, `due_date`, `reminder_at`, `completed_at`, `created_at`
and `updated_at`.

- `status` is a PostgreSQL enum: `TODO` → `IN_PROGRESS` → `COMPLETED`
- `priority` is an enum declared `LOW` → `MEDIUM` → `HIGH` → `URGENT`, so
  ordering by it in SQL sorts by real severity with no lookup table
- `completed_at` is derived from `status` server-side; the client cannot set it
- `project_id` is `ON DELETE SET NULL` — deleting a project keeps its tasks
- Everything else is `ON DELETE CASCADE` from `users.id`, so deleting an account
  removes all of its data in one statement

**Indexes.** All timestamps are `timestamptz`. Every read path filters on
`user_id` first, so it leads each composite index:

| Index | Serves |
| --- | --- |
| `tasks_user_status_idx` | Status filters |
| `tasks_user_priority_idx` | Priority filters |
| `tasks_user_due_date_idx` | Due-date windows, calendar ranges |
| `tasks_user_project_idx` | Project filters, project pages |
| `tasks_user_created_idx` | Default sort (`created_at DESC`) |
| `tasks_user_status_due_idx` | Overdue / due-today counters, which filter on both |
| `task_tags_tag_id_idx` | Reverse lookup from a tag to its tasks |
| `sessions_token_hash_unique` | Session resolution on every request |

---

## Architecture notes

Ten decisions worth knowing about.

**1. Two drivers, one database engine.** With `DATABASE_URL` set, the app uses
`postgres-js` against a real server. Without it, PGlite — PostgreSQL compiled to
WASM — persisted to a directory. Both are PostgreSQL, so migrations, SQL and
behaviour are identical, and a contributor can clone and run with no database to
install. `src/db/index.ts` picks the driver, loads only the one in use, and is
the single place where the two types are reconciled.

**2. Authorisation lives in the WHERE clause.** No service function accepts a
task id without also taking a user id, and ownership is part of the predicate:

```ts
.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
```

A row belonging to someone else and a row that does not exist are therefore
indistinguishable — both produce a 404. There is no path where a check is
forgotten after the data has already been fetched, because the data is never
fetched unscoped. `tests/authorization.test.ts` asserts this from the outside.

**3. Sessions, not JWTs.** A random 256-bit token goes in an httpOnly,
SameSite=Lax cookie; only its HMAC (keyed by `AUTH_SECRET`) is stored, so read
access to the sessions table cannot be replayed as a login. Sessions can be
revoked immediately — which a stateless JWT cannot — and changing a password
signs out every other device.

**4. scrypt for passwords.** Memory-hard, in Node's standard library, so there
is no native module to compile per platform. Parameters are recorded inside each
digest, so they can be raised later without invalidating existing hashes. A
failed login burns comparable CPU against a dummy hash, so response time does
not reveal whether an address is registered.

**5. Filter state lives in the URL.** The task list is a Server Component
reading `searchParams`; the controls only rewrite the URL. Filtering is a real
SQL query rather than the client hiding rows it already downloaded, and a
filtered view is shareable, refreshable and works with the back button. Search
is debounced by 300 ms so typing costs one request, not one per keystroke.

**6. Reads go direct, writes go through the API.** Server Components call the
service layer in-process — no HTTP round trip to the app's own API for its
first paint. Mutations go through REST handlers from the client, then
`router.refresh()` re-renders the server tree. Route handlers stay thin: parse →
validate → authenticate → call a service → respond.

**7. One validation layer, both sides.** The Zod schemas in
`src/lib/validation.ts` run in the browser for instant inline feedback *and* on
the server, which trusts nothing from the client. Field-level errors come back
in a `{ field: message }` map that forms render against the matching input.
Query strings go through the same schemas, so a hand-edited URL produces a
message rather than a crash.

**8. Time zones are decided by the viewer, not the server.** Timestamps are
absolute (`timestamptz`), but "overdue" and "due today" are calendar questions
whose answer depends on where you are. The browser reports its IANA zone in a
cookie, and `src/lib/date.ts` turns that plus an instant into the UTC bounds of
the corresponding local day — correctly across DST transitions and half-hour
offsets, which `tests/date.test.ts` pins down.

**9. No component library, no chart library.** The UI primitives are built here:
roughly 900 lines for button, card, badge, field, dialog, menu, toast and state
components, with the accessibility behaviour written deliberately — focus trap
and restore in dialogs, arrow-key navigation in menus, a polite live region for
toasts, every control bound to its label and error. The three dashboard charts
are inline SVG that renders on the server and reads correctly in both themes.
Both choices trade a little code for no dependency risk and full control.

**10. Theme is resolved before the first byte.** The preference is a cookie, so
the server renders the correct theme immediately; a tiny inline script resolves
"system" before first paint. There is no flash of the wrong colours. Signed-in
users also have the preference persisted to their account.

---

## Security

| Concern | Handling |
| --- | --- |
| Password storage | scrypt (N=16384, r=8, p=1), 16-byte random salt, 64-byte digest, constant-time comparison |
| Session tokens | 256 bits of CSPRNG entropy; only the HMAC is stored |
| Cookies | `httpOnly`, `SameSite=Lax`, `Secure` in production, explicit expiry, sliding renewal |
| Authentication | Every protected route handler calls `requireUser()`; every protected page calls `requireUserOrRedirect()` |
| Authorisation | Ownership is part of every query's WHERE clause; cross-user access returns 404 |
| Input validation | Zod on the server for every body and query string; the client's own validation is never trusted |
| SQL injection | Parameterised throughout via Drizzle; LIKE wildcards in search terms are escaped |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` outside the inline theme script, which contains no user data |
| Error leakage | Only typed `AppError`s reach the user; everything else is logged server-side and returned as a generic 500 |
| Account enumeration | Sign-in returns one message for both causes, with matched timing |
| Brute force | Fixed-window rate limits on sign-in, sign-up and password change |
| Secrets | Read only in server modules; `AUTH_SECRET` is mandatory in production |

**One caveat, stated plainly:** the rate limiter in `src/lib/rate-limit.ts` is
per-process and in-memory. On a single instance it does its job. Across several
instances it slows an attacker down proportionally rather than absolutely — put
a shared limiter (Redis/Upstash) or the platform's WAF in front for a serious
deployment.

---

## Deployment

The app is a standard Next.js application and deploys anywhere Next runs. It
needs a Node.js runtime — several routes use `node:crypto` — so edge-only
hosting will not work.

### Vercel

1. Push the repository and import it.
2. Set environment variables:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `AUTH_SECRET` — a fresh 32+ byte secret
   - `NEXT_PUBLIC_APP_URL` — e.g. `https://taskflow.example.com`
3. Deploy. Build and start commands are the defaults.
4. Apply migrations against the production database:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

### Anywhere else (Docker, a VM, a container platform)

```bash
npm ci
npm run build
DATABASE_URL="postgresql://..." AUTH_SECRET="..." npm start
```

### Before you go live

- [ ] `AUTH_SECRET` is set and is not the development fallback
- [ ] `DATABASE_URL` points at a real PostgreSQL server (not PGlite)
- [ ] `NEXT_PUBLIC_APP_URL` uses `https://`, so cookies are marked `Secure`
- [ ] Migrations have been applied
- [ ] The demo accounts have been removed, or the seed was never run in production
- [ ] A shared rate limiter sits in front, if you run more than one instance

---

## A note on two generated files

`AGENTS.md` and `CLAUDE.md` in the project root are written by `next dev` itself
(Next 16 regenerates them on every start). They are not part of this
application. Set `agentRules: false` in `next.config.ts` to stop them.
