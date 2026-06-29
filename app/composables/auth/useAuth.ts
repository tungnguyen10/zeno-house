export function useAuth() {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()

  function getRedirectTo() {
    const configuredUrl = config.public.siteUrl
    const origin = typeof configuredUrl === 'string' && configuredUrl.length > 0
      ? configuredUrl
      : window.location.origin

    return `${origin.replace(/\/$/, '')}/auth/callback`
  }

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await navigateTo('/')
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectTo(),
      },
    })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  return { login, loginWithGoogle, logout }
}
