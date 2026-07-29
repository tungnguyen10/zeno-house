import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteUser = vi.hoisted(() => vi.fn())
const serverClient = vi.hoisted(() => ({
  auth: { admin: { deleteUser } },
}))
const db = vi.hoisted(() => vi.fn(() => serverClient))

vi.mock('../../../server/utils/db', () => ({ db }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UserRepository.remove', () => {
  it('reports a successful hard delete', async () => {
    deleteUser.mockResolvedValueOnce({ error: null })
    const { UserRepository } = await import('../../../server/repositories/users')

    await expect(UserRepository.remove({ context: {} } as never, 'auth-1')).resolves.toBe('deleted')
    expect(deleteUser).toHaveBeenCalledWith('auth-1')
  })

  it('falls back to an irreversible soft delete when a historical FK blocks deletion', async () => {
    deleteUser
      .mockResolvedValueOnce({
        error: {
          status: 500,
          code: 'unexpected_failure',
          message: 'Database error deleting user',
        },
      })
      .mockResolvedValueOnce({ error: null })
    const { UserRepository } = await import('../../../server/repositories/users')

    await expect(UserRepository.remove({ context: {} } as never, 'auth-1')).resolves.toBe('deactivated')
    expect(deleteUser).toHaveBeenNthCalledWith(1, 'auth-1')
    expect(deleteUser).toHaveBeenNthCalledWith(2, 'auth-1', true)
  })

  it('does not hide unrelated Auth failures behind soft deletion', async () => {
    deleteUser.mockResolvedValueOnce({
      error: { status: 503, code: 'service_unavailable', message: 'Auth unavailable' },
    })
    const { UserRepository } = await import('../../../server/repositories/users')

    await expect(UserRepository.remove({ context: {} } as never, 'auth-1')).rejects.toBeTruthy()
    expect(deleteUser).toHaveBeenCalledTimes(1)
  })
})
