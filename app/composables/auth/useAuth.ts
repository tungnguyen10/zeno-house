import { getRedirectByRole } from '~/utils/auth-redirect'

export function useAuth() {
  const supabase = useSupabaseClient()

  function getRedirectTo() {
    // Always use current origin so redirect works correctly in both local dev and production
    return `${window.location.origin}/auth/callback`
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const role = data.user?.app_metadata?.role as string | null | undefined
    await navigateTo(getRedirectByRole(role))
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
