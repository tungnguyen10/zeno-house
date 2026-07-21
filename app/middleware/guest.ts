import { getRedirectByRole } from '~/utils/auth-redirect'
import { requiresTenantOnboarding } from '~/utils/tenant-onboarding'

export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser()
  if (user.value) {
    if (requiresTenantOnboarding(user.value)) return navigateTo('/auth/complete-account')
    const role = user.value.app_metadata?.role as string | null | undefined
    return navigateTo(getRedirectByRole(role))
  }
})
