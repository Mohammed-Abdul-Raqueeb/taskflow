import { getDb } from '@/db'
import { jsonOk, noContent, readJson, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { ValidationError } from '@/lib/errors'
import { deleteProject, getProjectById, updateProject } from '@/lib/services/projects'
import { parseOrThrow, updateProjectSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function readId(context: Context): Promise<string> {
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) throw new ValidationError('That is not a valid project id.')
  return id
}

export const GET = route(async (_request, context: Context) => {
  const user = await requireUser()
  const db = await getDb()
  const project = await getProjectById(db, user.id, await readId(context))
  return jsonOk({ project })
})

export const PATCH = route(async (request, context: Context) => {
  const user = await requireUser()
  const db = await getDb()
  const input = parseOrThrow(updateProjectSchema, await readJson(request))
  const project = await updateProject(db, user.id, await readId(context), input)
  return jsonOk({ project })
})

export const DELETE = route(async (_request, context: Context) => {
  const user = await requireUser()
  const db = await getDb()
  await deleteProject(db, user.id, await readId(context))
  return noContent()
})
