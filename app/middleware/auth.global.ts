import { getRedirectByRole } from '~/utils/auth-redirect'

const PUBLIC_ROUTES = ['/login', '/auth/callback']

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

  if (role === 'tenant' && !isPortalRoute) return navigateTo('/portal')
  if (role !== 'tenant' && isPortalRoute) return navigateTo(getRedirectByRole(role))
})
