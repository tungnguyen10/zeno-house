import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const navigateTo = vi.fn((path: string) => path)
const signInWithPassword = vi.fn()
const signUp = vi.fn()
const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()
const refreshSession = vi.fn()
const linkIdentity = vi.fn()
const apiFetch = vi.fn()
const currentUser = ref<Record<string, unknown> | null>(null)

vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('apiFetch', apiFetch)
vi.stubGlobal('useSupabaseUser', () => currentUser)
vi.stubGlobal('useSupabaseClient', () => ({
  auth: {
    signInWithPassword,
    signUp,
    resetPasswordForEmail,
    updateUser,
    linkIdentity,
    refreshSession,
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
}))
vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: unknown) => middleware)

const { useAuth } = await import('../../app/composables/auth/useAuth')
const { default: guestMiddleware } = await import('../../app/middleware/guest')

describe('auth landing routes', () => {
  beforeEach(() => {
    currentUser.value = null
    navigateTo.mockClear()
    signInWithPassword.mockReset()
    apiFetch.mockReset()
    updateUser.mockReset()
    linkIdentity.mockReset()
    refreshSession.mockReset()
  })

  it.each([
    ['admin', '/dashboard'],
    ['owner', '/dashboard'],
    ['manager', '/dashboard'],
    ['tenant', '/portal'],
  ])('routes a successful %s password login to %s', async (role, expected) => {
    signInWithPassword.mockResolvedValue({
      data: { user: { app_metadata: { role } } },
      error: null,
    })

    await useAuth().login('person@example.com', 'secret')

    expect(navigateTo).toHaveBeenCalledWith(expected)
  })

  it('routes a successful login with a missing role to pending', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null })

    await useAuth().login('person@example.com', 'secret')

    expect(navigateTo).toHaveBeenCalledWith('/auth/pending')
  })

  it('routes a tenant with unfinished onboarding to complete-account', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { app_metadata: { role: 'tenant', tenant_onboarding: 'password_required' } } },
      error: null,
    })

    await useAuth().login('person@example.com', 'secret')

    expect(navigateTo).toHaveBeenCalledWith('/auth/complete-account')
  })

  it('registers without accepting a role and routes an immediate session to pending', async () => {
    signUp.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
    const result = await useAuth().register({ full_name: 'A', email: 'a@example.com', password: 'password-123', password_confirmation: 'password-123' }, 'captcha-token')
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@example.com',
      options: expect.objectContaining({ data: { full_name: 'A' }, captchaToken: 'captcha-token' }),
    }))
    expect(result.requiresEmailConfirmation).toBe(false)
    expect(navigateTo).toHaveBeenCalledWith('/auth/pending')
  })

  it('sends recovery and updates password through Supabase Auth', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    await useAuth().requestPasswordReset('a@example.com')
    await useAuth().updatePassword('password-123')
    expect(resetPasswordForEmail).toHaveBeenCalled()
    expect(updateUser).toHaveBeenCalledWith({ password: 'password-123' })
  })

  it('uses the lifecycle APIs and links Google to the existing Auth user', async () => {
    apiFetch.mockResolvedValue({})
    refreshSession.mockResolvedValue({ data: { session: {} }, error: null })
    updateUser.mockResolvedValue({ error: null })
    linkIdentity.mockResolvedValue({ error: null })

    const auth = useAuth()
    await auth.setOnboardingPassword('password-123')
    await auth.requestOnboardingEmail('tenant@example.com')
    await auth.confirmOnboardingEmail()
    await auth.linkGoogleIdentity()
    await auth.confirmGoogleIdentity()

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/auth/tenant-onboarding/password', {
      method: 'POST', body: { password: 'password-123' },
    })
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/auth/tenant-onboarding/email', {
      method: 'POST', body: { email: 'tenant@example.com' },
    })
    expect(apiFetch).toHaveBeenNthCalledWith(3, '/api/auth/tenant-onboarding/email/confirm', { method: 'POST' })
    expect(apiFetch).toHaveBeenNthCalledWith(4, '/api/auth/tenant-onboarding/google/confirm', { method: 'POST' })
    expect(updateUser).toHaveBeenCalledWith(
      { email: 'tenant@example.com' },
      { emailRedirectTo: `${window.location.origin}/auth/complete-account` },
    )
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/complete-account` },
    })
  })

  it('keeps the current Supabase session refreshable after onboarding password change', async () => {
    apiFetch.mockResolvedValue({})
    refreshSession.mockResolvedValue({ data: { session: {} }, error: null })

    await useAuth().setOnboardingPassword('password-123')

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/tenant-onboarding/password', {
      method: 'POST', body: { password: 'password-123' },
    })
    expect(refreshSession).toHaveBeenCalledOnce()
  })

  it.each([
    ['admin', '/dashboard'],
    ['owner', '/dashboard'],
    ['manager', '/dashboard'],
    ['tenant', '/portal'],
  ])('redirects an authenticated %s away from login to %s', async (role, expected) => {
    currentUser.value = { app_metadata: { role } }

    expect(await guestMiddleware({ path: '/login' } as never, {} as never)).toBe(expected)
  })

  it('keeps a staged tenant on the complete-account route when visiting login', async () => {
    currentUser.value = {
      app_metadata: { role: 'tenant', tenant_onboarding: 'email_required' },
    }

    expect(await guestMiddleware({ path: '/login' } as never, {} as never)).toBe('/auth/complete-account')
  })
})
