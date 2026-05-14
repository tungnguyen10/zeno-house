const PUBLIC_ROUTES = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  // Fast path: reactive state already set (normal navigation)
  const user = useSupabaseUser()
  if (user.value) return

  // Fallback: check session directly from storage
  // Handles timing gap right after signInWithPassword before useSupabaseUser() updates
  const { data: { session } } = await useSupabaseClient().auth.getSession()
  if (!session) {
    return navigateTo('/login')
  }
})
