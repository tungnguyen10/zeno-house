import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { measureApiSegment } from './performance'

export async function requireAuth(event: H3Event): Promise<AuthUser> {
  if (event.context.user) return event.context.user

  // serverSupabaseUser returns JWT claims (not a Supabase User). The user id lives
  // on `sub`; we normalize it to `id` so callers can use the conventional field name.
  const claims = await measureApiSegment(event, 'auth', () => serverSupabaseUser(event))
  if (!claims || !claims.sub) {
    throw createError({
      statusCode: 401,
      data: { error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập' } },
    })
  }
  const user = { ...claims, id: claims.sub } as unknown as AuthUser
  event.context.user = user
  return user
}
