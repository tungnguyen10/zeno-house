import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

const input = { full_name: 'Nguyễn Văn A', phone: '0901234567' } as never

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('useTenantQuickCreate', () => {
  it('returns created summary', async () => {
    fetchMock.mockResolvedValue({ data: { id: 't-1', code: 'kt-1', fullName: 'Nguyễn Văn A', phone: '0901234567', status: 'active' } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    const res = await useTenantQuickCreate().submit(input)
    expect(res).toEqual({ kind: 'created', tenant: { id: 't-1', code: 'kt-1', fullName: 'Nguyễn Văn A', phone: '0901234567' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants', expect.objectContaining({ method: 'POST', body: input }))
  })

  it('classifies TENANT_DUPLICATE', async () => {
    fetchMock.mockRejectedValue({ statusCode: 409, data: { error: { code: 'TENANT_DUPLICATE', message: 'x', details: { existingTenantId: 't-9', fieldErrors: { phone: ['x'] } } } } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    expect(await useTenantQuickCreate().submit(input)).toEqual({ kind: 'duplicate', existingTenantId: 't-9', fields: ['phone'] })
  })

  it('passes through generic identity conflict message', async () => {
    fetchMock.mockRejectedValue({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' } } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    expect(await useTenantQuickCreate().submit(input)).toEqual({ kind: 'conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' })
  })

  it('returns field errors on 422', async () => {
    fetchMock.mockRejectedValue({ statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: { fieldErrors: { phone: ['Số điện thoại không hợp lệ'] } } } } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    const res = await useTenantQuickCreate().submit(input)
    expect(res).toMatchObject({ kind: 'error', fieldErrors: { phone: ['Số điện thoại không hợp lệ'] } })
  })

  it('never writes to localStorage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    fetchMock.mockResolvedValue({ data: { id: 't-1', code: 'c', fullName: 'A', phone: 'p', status: 'active' } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    await useTenantQuickCreate().submit(input)
    expect(spy).not.toHaveBeenCalled()
  })
})
