import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const navigateTo = vi.fn((path: string) => path)
const signInWithPassword = vi.fn()
const signUp = vi.fn()
const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()
const refreshSession = vi.fn()
const signInWithOAuth = vi.fn()
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
    refreshSession,
    signInWithOAuth,
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
    refreshSession.mockReset()
    signInWithOAuth.mockReset()
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

  it('keeps Google as a normal login option', async () => {
    signInWithOAuth.mockResolvedValue({ error: null })

    await useAuth().loginWithGoogle()

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
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

  it('uses only the password lifecycle API for tenant onboarding', async () => {
    apiFetch.mockResolvedValue({})
    refreshSession.mockResolvedValue({ data: { session: {} }, error: null })

    const auth = useAuth()
    await auth.setOnboardingPassword('password-123')

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/tenant-onboarding/password', {
      method: 'POST', body: { password: 'password-123' },
    })
    expect(auth).not.toHaveProperty('requestOnboardingEmail')
    expect(auth).not.toHaveProperty('confirmOnboardingEmail')
    expect(auth).not.toHaveProperty('linkGoogleIdentity')
    expect(auth).not.toHaveProperty('confirmGoogleIdentity')
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

  it('ignores a legacy onboarding stage when visiting login', async () => {
    currentUser.value = {
      app_metadata: { role: 'tenant', tenant_onboarding: 'email_required' },
    }

    expect(await guestMiddleware({ path: '/login' } as never, {} as never)).toBe('/portal')
  })
})
