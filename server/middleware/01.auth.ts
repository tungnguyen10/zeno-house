import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  event.context.user = await serverSupabaseUser(event)
})
