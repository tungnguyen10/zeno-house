import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantId: vi.fn(),
  updateCurrentPassword: vi.fn(),
  findActiveContract: vi.fn(),
  auditBegin: vi.fn(),
  auditComplete: vi.fn(),
}))

vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: mocks.resolveTenantId }))
vi.mock('../../../server/repositories/users', () => ({
  UserRepository: { updateCurrentPassword: mocks.updateCurrentPassword },
}))
vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: { findActiveByTenantId: mocks.findActiveContract },
}))
vi.mock('../../../server/services/audit-operations', () => ({
  AuditOperationService: { begin: mocks.auditBegin, complete: mocks.auditComplete },
}))

const tenantUser = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as never

describe('TenantPasswordService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.findActiveContract.mockResolvedValue({ buildingId: 'building-1' })
    mocks.updateCurrentPassword.mockResolvedValue(undefined)
    mocks.auditBegin.mockResolvedValue({ id: 'operation-1' })
  })

  it('verifies the current password and appends a credential-free audit event', async () => {
    const { TenantPasswordService } = await import('../../../server/services/tenant-portal/password')
    const input = {
      current_password: 'mat-khau-cu',
      password: 'mat-khau-moi',
      password_confirmation: 'mat-khau-moi',
    }

    await TenantPasswordService.change({} as never, tenantUser, input)

    expect(mocks.updateCurrentPassword).toHaveBeenCalledWith(
      expect.anything(),
      'mat-khau-moi',
      'mat-khau-cu',
    )
    expect(mocks.auditBegin).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: 'auth-tenant',
      buildingId: 'building-1',
      action: 'tenant.account.password_changed',
      entityType: 'tenant',
      entityId: 'tenant-1',
    }))
    expect(mocks.auditComplete).toHaveBeenCalledWith(expect.anything(), 'operation-1', { outcomeData: { auth: 'updated' } })
    expect(JSON.stringify(mocks.auditBegin.mock.calls)).not.toContain('mat-khau')
  })

  it('does not audit a rejected password change', async () => {
    mocks.updateCurrentPassword.mockRejectedValue({ statusCode: 422 })
    const { TenantPasswordService } = await import('../../../server/services/tenant-portal/password')

    await expect(TenantPasswordService.change({} as never, tenantUser, {
      current_password: 'sai-mat-khau',
      password: 'mat-khau-moi',
      password_confirmation: 'mat-khau-moi',
    })).rejects.toMatchObject({ statusCode: 422 })

    expect(mocks.auditBegin).toHaveBeenCalledOnce()
    expect(mocks.auditComplete).not.toHaveBeenCalled()
  })
})
