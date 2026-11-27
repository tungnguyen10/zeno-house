import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
const sessionKey = ref('tenant-a')
vi.stubGlobal('usePortalSessionKey', () => sessionKey)

const valid = {
  current_password: 'mat-khau-cu',
  password: 'mat-khau-moi',
  password_confirmation: 'mat-khau-moi',
}

describe('usePortalPassword', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionKey.value = 'tenant-a' })

  it('posts validated credentials to the tenant password endpoint', async () => {
    fetchMock.mockResolvedValue({ data: null })
    const { usePortalPassword } = await import('../../app/composables/tenant-portal/usePortalPassword')
    const { change } = usePortalPassword()

    await expect(change(valid)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/password', {
      method: 'POST',
      body: valid,
      signal: expect.any(AbortSignal),
    })
  })

  it('aborts and ignores a password result after the account changes', async () => {
    let resolve!: (value: unknown) => void
    fetchMock.mockReturnValue(new Promise(done => { resolve = done }))
    const { usePortalPassword } = await import('../../app/composables/tenant-portal/usePortalPassword')
    const form = usePortalPassword()
    const pending = form.change(valid)
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal
    sessionKey.value = 'tenant-b'
    expect(signal.aborted).toBe(true)
    expect(form.saving.value).toBe(false)
    resolve({ data: null })
    await expect(pending).resolves.toBe(false)
    expect(form.apiError.value).toBeNull()
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
