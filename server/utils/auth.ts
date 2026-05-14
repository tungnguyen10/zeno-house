import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'

export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      data: { error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập' } },
    })
  }
  return user as unknown as AuthUser
}
