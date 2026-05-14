export function useAuth() {
  const supabase = useSupabaseClient()

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await navigateTo('/')
  }

  async function logout() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  return { login, logout }
}
