import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const navigateTo = vi.fn((path: string) => path)
const getSession = vi.fn()
const currentUser = ref<Record<string, unknown> | null>(null)

vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: unknown) => middleware)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useSupabaseUser', () => currentUser)
vi.stubGlobal('useSupabaseClient', () => ({ auth: { getSession } }))

const { default: authMiddleware } = await import('../../app/middleware/auth.global')

function userWithRole(role: string) {
  return { app_metadata: { role } }
}

describe('global auth middleware', () => {
  beforeEach(() => {
    currentUser.value = null
    navigateTo.mockClear()
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: null } })
  })

  it.each(['/login', '/register', '/forgot-password', '/auth/callback', '/auth/reset-password'])('keeps public route %s open', async (path) => {
    expect(await authMiddleware({ path } as never, {} as never)).toBeUndefined()
    expect(getSession).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('redirects an unauthenticated request to login', async () => {
    expect(await authMiddleware({ path: '/dashboard' } as never, {} as never)).toBe('/login')
    expect(getSession).toHaveBeenCalledOnce()
  })

  it('uses the session fallback before applying the namespace matrix', async () => {
    getSession.mockResolvedValue({ data: { session: { user: userWithRole('admin') } } })

    expect(await authMiddleware({ path: '/dashboard' } as never, {} as never)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it.each(['admin', 'owner', 'manager'])('allows %s in the dashboard namespace', async (role) => {
    currentUser.value = userWithRole(role)

    expect(await authMiddleware({ path: '/dashboard/buildings' } as never, {} as never)).toBeUndefined()
    expect(getSession).not.toHaveBeenCalled()
  })

  it.each(['admin', 'owner', 'manager'])('redirects %s out of the portal namespace', async (role) => {
    currentUser.value = userWithRole(role)

    expect(await authMiddleware({ path: '/portal' } as never, {} as never)).toBe('/dashboard')
  })

  it.each(['/dashboard', '/dashboard/buildings', '/'])('locks a tenant to the portal namespace from %s', async (path) => {
    currentUser.value = userWithRole('tenant')

    expect(await authMiddleware({ path } as never, {} as never)).toBe('/portal')
  })

  it('allows a tenant inside the portal namespace', async () => {
    currentUser.value = userWithRole('tenant')

    expect(await authMiddleware({ path: '/portal/profile' } as never, {} as never)).toBeUndefined()
  })

  it('locks an onboarding tenant to the complete-account route', async () => {
    currentUser.value = { app_metadata: { role: 'tenant', tenant_onboarding: 'password_required' } }

    expect(await authMiddleware({ path: '/portal/profile' } as never, {} as never)).toBe('/auth/complete-account')
    expect(await authMiddleware({ path: '/auth/complete-account' } as never, {} as never)).toBeUndefined()
  })

  it.each(['email_required', 'google_required'])('ignores the legacy %s stage', async (stage) => {
    currentUser.value = { app_metadata: { role: 'tenant', tenant_onboarding: stage } }

    expect(await authMiddleware({ path: '/portal/profile' } as never, {} as never)).toBeUndefined()
  })

  it('routes an unknown authenticated role out of the portal without looping', async () => {
    currentUser.value = userWithRole('unknown')

    expect(await authMiddleware({ path: '/portal' } as never, {} as never)).toBe('/login')
  })

  it('locks a missing-role session to the pending route', async () => {
    currentUser.value = { app_metadata: {} }
    expect(await authMiddleware({ path: '/dashboard' } as never, {} as never)).toBe('/auth/pending')
    expect(await authMiddleware({ path: '/auth/pending' } as never, {} as never)).toBeUndefined()
  })

  it('redirects known roles away from pending', async () => {
    currentUser.value = userWithRole('admin')
    expect(await authMiddleware({ path: '/auth/pending' } as never, {} as never)).toBe('/dashboard')
  })
})
