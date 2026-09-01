import { getDb } from '@/db'
import { jsonCreated, jsonOk, readJson, route } from '@/lib/api/http'
import { requireUser } from '@/lib/auth/current-user'
import { createTag, listTags } from '@/lib/services/tags'
import { createTagSchema, parseOrThrow } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const user = await requireUser()
  const db = await getDb()
  return jsonOk({ tags: await listTags(db, user.id) })
})

export const POST = route(async (request) => {
  const user = await requireUser()
  const db = await getDb()
  const input = parseOrThrow(createTagSchema, await readJson(request))
  return jsonCreated({ tag: await createTag(db, user.id, input) })
})
