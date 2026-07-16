import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const navigateTo = vi.fn((path: string) => path)
const signInWithPassword = vi.fn()
const currentUser = ref<Record<string, unknown> | null>(null)

vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useSupabaseUser', () => currentUser)
vi.stubGlobal('useSupabaseClient', () => ({
  auth: {
    signInWithPassword,
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

  it('routes a successful login with a missing role back to login', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null })

    await useAuth().login('person@example.com', 'secret')

    expect(navigateTo).toHaveBeenCalledWith('/login')
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
})
