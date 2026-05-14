import { serverSupabaseUser } from '#supabase/server'
import type { AuthUser } from '~/types/auth'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  event.context.user = (await serverSupabaseUser(event)) as unknown as AuthUser | null
})
