import { getRedirectByRole } from '~/utils/auth-redirect'

export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser()
  if (user.value) {
    const role = user.value.app_metadata?.role as string | null | undefined
    return navigateTo(getRedirectByRole(role))
  }
})
