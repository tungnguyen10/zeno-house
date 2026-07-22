import { serverSupabaseUser } from '#supabase/server'
import type { AuthUser } from '~/types/auth'
import { measureApiSegment } from '../utils/performance'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  // serverSupabaseUser returns JWT claims; normalize `sub` to `id` so downstream
  // code can rely on `user.id` matching the auth.users PK.
  const claims = await measureApiSegment(event, 'auth', () => serverSupabaseUser(event))
  event.context.user = claims && claims.sub
    ? ({ ...claims, id: claims.sub } as unknown as AuthUser)
    : null
})
