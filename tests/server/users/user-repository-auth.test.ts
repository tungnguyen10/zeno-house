import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateUser = vi.hoisted(() => vi.fn())
const getUserById = vi.hoisted(() => vi.fn())
const updateUserById = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => vi.fn(() => ({
  auth: { admin: { getUserById, updateUserById } },
})))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(async () => ({ auth: { updateUser } })),
}))
vi.mock('../../../server/utils/db', () => ({ db }))

vi.stubGlobal('throwValidationError', (message: string) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message } } }
})
vi.stubGlobal('throwDbError', (error: unknown) => { throw error })

const { UserRepository } = await import('../../../server/repositories/users')

describe('UserRepository current password update', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps Supabase same_password to a validation error', async () => {
    updateUser.mockResolvedValue({ error: { code: 'same_password', status: 422 } })

    await expect(UserRepository.updateCurrentPassword({} as never, 'password-123'))
      .rejects.toMatchObject({
        statusCode: 422,
        data: { error: { message: 'Mật khẩu mới phải khác mật khẩu hiện tại' } },
      })
  })

  it('clears onboarding with null because Supabase merges app metadata', async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          app_metadata: { role: 'tenant', tenant_onboarding: 'password_required' },
        },
      },
      error: null,
    })
    updateUserById.mockResolvedValue({ error: null })

    await UserRepository.setTenantOnboardingStage({} as never, 'auth-1', null)

    expect(updateUserById).toHaveBeenCalledWith('auth-1', {
      app_metadata: { role: 'tenant', tenant_onboarding: null },
    })
  })
})
