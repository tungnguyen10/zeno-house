import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

const valid = {
  current_password: 'mat-khau-cu',
  password: 'mat-khau-moi',
  password_confirmation: 'mat-khau-moi',
}

describe('usePortalPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts validated credentials to the tenant password endpoint', async () => {
    fetchMock.mockResolvedValue({ data: null })
    const { usePortalPassword } = await import('../../app/composables/tenant-portal/usePortalPassword')
    const { change } = usePortalPassword()

    await expect(change(valid)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/password', {
      method: 'POST',
      body: valid,
    })
  })

  it('exposes current-password field feedback from the server', async () => {
    fetchMock.mockRejectedValue({
      data: {
        error: {
          message: 'Mật khẩu hiện tại không đúng',
          details: {
            fieldErrors: {
              current_password: ['Mật khẩu hiện tại không đúng'],
            },
          },
        },
      },
    })
    const { usePortalPassword } = await import('../../app/composables/tenant-portal/usePortalPassword')
    const { change, fieldErrors, apiError } = usePortalPassword()

    await expect(change(valid)).resolves.toBe(false)
    expect(fieldErrors.value.current_password).toEqual(['Mật khẩu hiện tại không đúng'])
    expect(apiError.value).toBe('Mật khẩu hiện tại không đúng')
  })
})
