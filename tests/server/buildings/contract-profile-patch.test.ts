import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findBuilding = vi.fn()
const findProfile = vi.fn()
const upsertProfile = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: findBuilding } }))
vi.mock('../../../server/repositories/building-contract-profiles', () => ({
  BuildingContractProfileRepository: { findByBuildingId: findProfile, upsert: upsertProfile },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({ BuildingInvoiceProfileRepository: { findByBuildingId: vi.fn() } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi', lessor_id_number: '012345678901', lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', lessor_email: null, brand_name: null,
  default_term_months: 12, default_deposit_months: 1, notice_days: null, deposit_refund_days: null, renewal_months: null,
  extra_occupant_fee: null, drilling_fee: null, fingerprint_reset_fee: null, signed_copies: 4, copies_per_party: 2,
  updated_by: 'o-1', created_at: 't', updated_at: 't',
}
const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (user: AuthUser) => String(user.app_metadata?.role) !== 'manager')
  findBuilding.mockResolvedValue({ id: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
  findProfile.mockResolvedValue(row)
  upsertProfile.mockImplementation(async (_e: unknown, _id: string, input: object) => ({ ...row, ...input }))
})

describe('BuildingContractProfileService.patch', () => {
  it('validates against the stored row but writes only the patched keys', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { notice_days: 30 })

    expect(upsertProfile.mock.calls[0]![2]).toEqual({ notice_days: 30 })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
  })

  it('writes the normalized value of the patched key', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { lessor_phone: '0901 234 568' })

    expect(upsertProfile.mock.calls[0]![2]).toEqual({ lessor_phone: '0901234568' })
  })

  it('creates a profile writing only the patched keys when none exists', async () => {
    findProfile.mockResolvedValue(null)
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { lessor_full_name: 'Chủ Mới' })

    expect(upsertProfile.mock.calls[0]![2]).toEqual({ lessor_full_name: 'Chủ Mới' })
  })

  it('rejects a patch that breaks the copies rule after merging', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.patch(ev(), owner, 'b-1', { signed_copies: 3 }))
      .rejects.toMatchObject({ statusCode: 422 })
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('forbids users without write permission', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.patch(ev(), manager, 'b-1', { notice_days: 30 })).rejects.toMatchObject({ statusCode: 403 })
  })

  describe('without building-contract-profile.pii.read', () => {
    beforeEach(() => {
      vi.stubGlobal('can', (_user: AuthUser, cap: string) => cap !== 'building-contract-profile.pii.read')
    })

    it.each(['lessor_date_of_birth', 'lessor_permanent_address', 'lessor_id_number'])('forbids patching %s', async (key) => {
      const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
      const value = key === 'lessor_date_of_birth' ? '1990-01-01' : key === 'lessor_id_number' ? '987654321' : 'Địa chỉ mới'
      await expect(BuildingContractProfileService.patch(ev(), owner, 'b-1', { [key]: value }))
        .rejects.toMatchObject({ statusCode: 403 })
      expect(upsertProfile).not.toHaveBeenCalled()
    })

    it('forbids nulling a PII field', async () => {
      const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
      await expect(BuildingContractProfileService.patch(ev(), owner, 'b-1', { lessor_id_number: null }))
        .rejects.toMatchObject({ statusCode: 403 })
    })

    it('still allows patching non-PII fields', async () => {
      const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
      await BuildingContractProfileService.patch(ev(), owner, 'b-1', { notice_days: 30 })
      expect(upsertProfile).toHaveBeenCalledTimes(1)
    })
  })

  it('audits only the patched field names, never values', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { lessor_email: 'chu@example.com' })

    const audit = appendAudit.mock.calls[0]![2]
    expect(audit.metadata.changed_fields).toEqual(['lessor_email'])
    expect(JSON.stringify(audit)).not.toContain('chu@example.com')
  })
})
