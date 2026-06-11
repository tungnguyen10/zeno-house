import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'

export async function requireAuth(event: H3Event): Promise<AuthUser> {
  // serverSupabaseUser returns JWT claims (not a Supabase User). The user id lives
  // on `sub`; we normalize it to `id` so callers can use the conventional field name.
  const claims = await serverSupabaseUser(event)
  if (!claims || !claims.sub) {
    throw createError({
      statusCode: 401,
      data: { error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập' } },
    })
  }
  return { ...claims, id: claims.sub } as unknown as AuthUser
}
