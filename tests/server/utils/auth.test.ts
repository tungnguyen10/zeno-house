import { beforeEach, describe, expect, it, vi } from 'vitest'

const serverSupabaseUser = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({ serverSupabaseUser }))
vi.stubGlobal('createError', (input: unknown) => input)

const { requireAuth } = await import('../../../server/utils/auth')

describe('requireAuth request memoization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reuses the user verified by auth middleware', async () => {
    const user = { id: 'auth-1', sub: 'auth-1', app_metadata: { role: 'owner' } }
    const event = { context: { user } } as never

    await expect(requireAuth(event)).resolves.toBe(user)
    expect(serverSupabaseUser).not.toHaveBeenCalled()
  })

  it('verifies, normalizes, and stores claims when middleware context is absent', async () => {
    serverSupabaseUser.mockResolvedValue({ sub: 'auth-2', app_metadata: { role: 'manager' } })
    const event = { context: {} } as never

    await expect(requireAuth(event)).resolves.toMatchObject({ id: 'auth-2', sub: 'auth-2' })
    await expect(requireAuth(event)).resolves.toMatchObject({ id: 'auth-2', sub: 'auth-2' })
    expect(serverSupabaseUser).toHaveBeenCalledTimes(1)
  })
})
