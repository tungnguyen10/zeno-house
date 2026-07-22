import { getRedirectByRole } from '~/utils/auth-redirect'
import { requiresTenantOnboarding } from '~/utils/tenant-onboarding'

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/auth/callback', '/auth/reset-password']
const PENDING_ROUTE = '/auth/pending'
const COMPLETE_ACCOUNT_ROUTE = '/auth/complete-account'

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  const reactiveUser = useSupabaseUser()
  let resolvedUser: { app_metadata?: unknown } | null = reactiveUser.value

  if (!resolvedUser || requiresTenantOnboarding(resolvedUser)) {
    // Covers timing gaps after sign-in and after onboarding refreshes the session.
    // The reactive user can briefly retain password_required after the refreshed
    // session has already cleared it.
    const { data: { session } } = await useSupabaseClient().auth.getSession()
    if (!session && !resolvedUser) return navigateTo('/login')
    if (session) resolvedUser = session.user
  }

  const metadata = resolvedUser?.app_metadata
  const role = metadata && typeof metadata === 'object'
    ? (metadata as Record<string, unknown>).role as string | null | undefined
    : undefined

  const isPortalRoute = to.path === '/portal' || to.path.startsWith('/portal/')
  const hasKnownRole = role === 'tenant' || role === 'admin' || role === 'owner' || role === 'manager'

  if (!hasKnownRole) {
    if (role) return navigateTo('/login')
    if (to.path !== PENDING_ROUTE) return navigateTo(PENDING_ROUTE)
    return
  }

  if (requiresTenantOnboarding(resolvedUser)) {
    if (to.path !== COMPLETE_ACCOUNT_ROUTE) return navigateTo(COMPLETE_ACCOUNT_ROUTE)
    return
  }

  if (to.path === COMPLETE_ACCOUNT_ROUTE) return navigateTo(getRedirectByRole(role))

  if (to.path === PENDING_ROUTE) return navigateTo(getRedirectByRole(role))

  if (role === 'tenant' && !isPortalRoute) return navigateTo('/portal')
  if (role !== 'tenant' && isPortalRoute) return navigateTo(getRedirectByRole(role))
})
