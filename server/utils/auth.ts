import type { H3Event } from 'h3'

export function requireAuth(event: H3Event) {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      data: { error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập' } },
    })
  }
  return user
}
