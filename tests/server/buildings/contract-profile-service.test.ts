import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findBuilding = vi.fn()
const findProfile = vi.fn()
const upsertProfile = vi.fn()
const findInvoiceProfile = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: findBuilding } }))
vi.mock('../../../server/repositories/building-contract-profiles', () => ({
  BuildingContractProfileRepository: { findByBuildingId: findProfile, upsert: upsertProfile },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { findByBuildingId: findInvoiceProfile },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const RAW_ID = '012345678901'
const building = {
  id: 'b-1', billingGenerationDay: 1, paymentDueDay: 5, electricityPricingType: 'per_kwh',
  defaultElectricityRate: 3500, waterPricingType: 'per_m3', defaultWaterRate: 15000,
}
const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi, Huế', lessor_id_number: RAW_ID, lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', brand_name: null, default_term_months: 12,
  default_deposit_months: 1, notice_days: 30, deposit_refund_days: 7, renewal_months: 0, extra_occupant_fee: 0,
  drilling_fee: 0, fingerprint_reset_fee: 0, signed_copies: 2, copies_per_party: 1, updated_by: 'o-1',
  created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}
const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (user: AuthUser, cap: string) => {
    const role = String(user.app_metadata?.role)
    if (cap === 'building-contract-profile.read') return ['admin', 'owner', 'manager'].includes(role)
    if (cap === 'buildings.read') return ['admin', 'owner', 'manager'].includes(role)
    return ['admin', 'owner'].includes(role)
  })
  findBuilding.mockResolvedValue(building)
  assertBuildingScope.mockResolvedValue(undefined)
  findProfile.mockResolvedValue(row)
  findInvoiceProfile.mockResolvedValue({ building_id: 'b-1' })
})

describe('BuildingContractProfileService.get', () => {
  it('returns full data to owner', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const res = await BuildingContractProfileService.get(ev(), owner, 'b-1')
    expect(res).toMatchObject({ lessorIdNumber: RAW_ID, lessorIdentityMasked: false })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'read')
  })

  it('never sends raw PII to a manager', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const res = await BuildingContractProfileService.get(ev(), manager, 'b-1')
    const json = JSON.stringify(res)
    expect(json).not.toContain(RAW_ID)
    expect(json).not.toContain('1980-01-02')
    expect(json).not.toContain('Lê Lợi')
    expect(res).toMatchObject({ lessorIdentityMasked: true, lessorIdNumber: '*******8901' })
  })

  it('checks scope before reading the profile', async () => {
    assertBuildingScope.mockRejectedValue(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.get(ev(), owner, 'b-1')).rejects.toMatchObject({ statusCode: 403 })
    expect(findProfile).not.toHaveBeenCalled()
  })
})

describe('BuildingContractProfileService.save', () => {
  it('forbids managers', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.save(ev(), manager, 'b-1', {} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('upserts and audits only changed field names', async () => {
    upsertProfile.mockResolvedValue({ ...row, lessor_id_number: '987654321' })
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const { buildingContractProfileSchema } = await import('~/utils/validators/building-contract-profile')
    const input = buildingContractProfileSchema.parse({
      ...Object.fromEntries(Object.entries(row).filter(([k]) => !['building_id', 'updated_by', 'created_at', 'updated_at'].includes(k))),
      lessor_id_number: '987654321',
    })

    await BuildingContractProfileService.save(ev(), owner, 'b-1', input)

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
    expect(upsertProfile).toHaveBeenCalledWith(expect.anything(), 'b-1', input, 'o-1')
    const audit = appendAudit.mock.calls[0]![2]
    expect(audit).toMatchObject({ action: 'building.contract_profile.updated', metadata: { changed_fields: ['lessor_id_number'] } })
    expect(audit.before_data).toBeUndefined()
    expect(audit.after_data).toBeUndefined()
    expect(JSON.stringify(audit)).not.toContain('987654321')
    expect(JSON.stringify(audit)).not.toContain(RAW_ID)
  })
})

describe('BuildingContractProfileService.readiness', () => {
  it('uses unmasked data even for managers', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const r = await BuildingContractProfileService.readiness(ev(), manager, 'b-1')
    expect(r.contract.ready).toBe(true)
  })
})
