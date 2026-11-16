import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(), findProfile: vi.fn(), updateProfile: vi.fn(),
  identityLookup: vi.fn(), audit: vi.fn(), contract: vi.fn(),
}))
vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: mocks.resolveTenantId }))
vi.mock('../../../server/repositories/tenant-portal/profile', () => ({ TenantProfileRepository: { findByTenantId: mocks.findProfile, updateByTenantId: mocks.updateProfile } }))
vi.mock('../../../server/services/tenants/identity-conflict', () => ({ TenantIdentityConflictService: { assertAvailable: mocks.identityLookup } }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.audit } }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findActiveByTenantId: mocks.contract } }))
const user = { id: 'fictional-auth', app_metadata: { role: 'tenant' } } as never
const forbidden = {
  full_name: 'Fixture Person', gender: 'other', date_of_birth: '1990-01-01',
  permanent_address: 'Fixture address', id_number: 'FAKE0001', id_issued_date: '2020-01-01',
  id_issued_place: 'Fixture office', notes: 'Private staff fixture', email: 'fixture@example.test',
  tenant_id: 'other-tenant', code: 'OTHER', status: 'archived',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveTenantId.mockResolvedValue('self-tenant')
  mocks.findProfile.mockResolvedValue({ id: 'self-tenant' })
  mocks.updateProfile.mockResolvedValue({ id: 'self-tenant' })
  mocks.contract.mockResolvedValue(null)
})

describe('strict tenant profile edit boundary', () => {
  for (const [key, value] of Object.entries(forbidden)) {
    it.each([false, true])(`rejects ${key}, mixed=%s, in schema and direct service before side effects`, async (mixed) => {
      const input = { ...(mixed ? { phone: '0900000000' } : {}), [key]: value }
      expect(tenantProfileUpdateSchema.safeParse(input).success).toBe(false)
      const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
      await expect(TenantProfileService.update({} as never, user, input as never))
        .rejects.toMatchObject({ statusCode: 422, data: { error: { code: 'VALIDATION_ERROR' } } })
      expect(mocks.identityLookup).not.toHaveBeenCalled()
      expect(mocks.updateProfile).not.toHaveBeenCalled()
      expect(mocks.audit).not.toHaveBeenCalled()
      expect(mocks.findProfile).not.toHaveBeenCalled()
    })
  }

  it('rejects an empty update with the API validation envelope', async () => {
    const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
    await expect(TenantProfileService.update({} as never, user, {})).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.identityLookup).not.toHaveBeenCalled()
  })

  it('normalizes only allowed contact fields and excludes self from phone conflicts', async () => {
    const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
    await TenantProfileService.update({} as never, user, { phone: '+84 90 000 0000', occupation: ' Fixture ', emergency_contact_name: null, emergency_contact_phone: null })
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.anything(), 'self-tenant', { phone: '0900000000', occupation: 'Fixture', emergency_contact_name: null, emergency_contact_phone: null })
    expect(mocks.identityLookup).toHaveBeenCalledWith(expect.anything(), user, { phone: '0900000000', excludeId: 'self-tenant' }, 'portal')
  })

  it('rejects a disabled live tenant before persistence or identity lookup', async () => {
    mocks.resolveTenantId.mockRejectedValue({ statusCode: 403 })
    const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
    await expect(TenantProfileService.update({} as never, user, { occupation: 'Fixture' })).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.identityLookup).not.toHaveBeenCalled()
    expect(mocks.updateProfile).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })
})

it('preserves a retryable phone rate limit without persistence or mutation audits', async () => {
  const failure = { statusCode: 429, data: { error: { code: 'RATE_LIMITED', details: { retryAfterSeconds: 120 } } } }
  mocks.identityLookup.mockRejectedValueOnce(failure)
  const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
  await expect(TenantProfileService.update({} as never, user, { phone: '0900000000' })).rejects.toMatchObject(failure)
  expect(mocks.updateProfile).not.toHaveBeenCalled()
  expect(mocks.audit).not.toHaveBeenCalled()
})
