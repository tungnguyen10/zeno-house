export function useAuth() {
  const supabase = useSupabaseClient()

  function getRedirectTo() {
    // Always use current origin so redirect works correctly in both local dev and production
    return `${window.location.origin}/auth/callback`
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
