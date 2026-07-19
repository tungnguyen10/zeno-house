import { getRedirectByRole } from '~/utils/auth-redirect'

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/auth/callback', '/auth/reset-password']
const PENDING_ROUTE = '/auth/pending'

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  const reactiveUser = useSupabaseUser()
  let role = reactiveUser.value?.app_metadata?.role as string | null | undefined

  if (!reactiveUser.value) {
    // Covers the timing gap after sign-in before useSupabaseUser() updates.
    const { data: { session } } = await useSupabaseClient().auth.getSession()
    if (!session) return navigateTo('/login')
    role = session.user.app_metadata?.role as string | null | undefined
  }

  const isPortalRoute = to.path === '/portal' || to.path.startsWith('/portal/')
  const hasKnownRole = role === 'tenant' || role === 'admin' || role === 'owner' || role === 'manager'

  if (!hasKnownRole) {
    if (role) return navigateTo('/login')
    if (to.path !== PENDING_ROUTE) return navigateTo(PENDING_ROUTE)
    return
  }

  if (to.path === PENDING_ROUTE) return navigateTo(getRedirectByRole(role))

  if (role === 'tenant' && !isPortalRoute) return navigateTo('/portal')
  if (role !== 'tenant' && isPortalRoute) return navigateTo(getRedirectByRole(role))
})
