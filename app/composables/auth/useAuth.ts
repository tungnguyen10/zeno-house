import { getRedirectByRole } from '~/utils/auth-redirect'
import type { AuthRegistrationInput } from '~/utils/validators/access-requests'
import { requiresTenantOnboarding } from '~/utils/tenant-onboarding'

export function useAuth() {
  const supabase = useSupabaseClient()

  function getRedirectTo() {
    // Always use current origin so redirect works correctly in both local dev and production
    return `${window.location.origin}/auth/callback`
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (requiresTenantOnboarding(data.user)) {
      await navigateTo('/auth/complete-account')
      return
    }
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

  async function register(input: AuthRegistrationInput, captchaToken?: string): Promise<{ requiresEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.full_name },
        emailRedirectTo: getRedirectTo(),
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    if (error) throw error
    const requiresEmailConfirmation = !data.session
    if (!requiresEmailConfirmation) await navigateTo('/auth/pending')
    return { requiresEmailConfirmation }
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  async function setOnboardingPassword(password: string) {
    await apiFetch('/api/auth/tenant-onboarding/password', { method: 'POST', body: { password } })
    await refreshSession()
  }

  async function requestOnboardingEmail(email: string) {
    await apiFetch('/api/auth/tenant-onboarding/email', { method: 'POST', body: { email } })
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/complete-account` },
    )
    if (error) throw error
  }

  async function confirmOnboardingEmail() {
    await apiFetch('/api/auth/tenant-onboarding/email/confirm', { method: 'POST' })
    await refreshSession()
  }

  async function linkGoogleIdentity() {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/complete-account` },
    })
    if (error) throw error
  }

  async function confirmGoogleIdentity() {
    await apiFetch('/api/auth/tenant-onboarding/google/confirm', { method: 'POST' })
    await refreshSession()
  }

  async function refreshSession() {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return data.session
  }

  async function logout() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  return {
    login,
    loginWithGoogle,
    register,
    requestPasswordReset,
    updatePassword,
    setOnboardingPassword,
    requestOnboardingEmail,
    confirmOnboardingEmail,
    linkGoogleIdentity,
    confirmGoogleIdentity,
    refreshSession,
    logout,
  }
}
