import { getDb } from '@/db'
import { jsonCreated, jsonOk, readJson, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { createProject, listProjects } from '@/lib/services/projects'
import { createProjectSchema, parseOrThrow } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()
  const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true'
  const projects = await listProjects(db, user.id, { includeArchived })
  return jsonOk({ projects })
})

export const POST = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()
  const input = parseOrThrow(createProjectSchema, await readJson(request))
  const project = await createProject(db, user.id, input)
  return jsonCreated({ project })
})
