import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can } from '../../../server/utils/permissions'

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
  vi.stubGlobal('can', can)
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
    assertBuildingScope.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }))
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.get(ev(), owner, 'b-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(findProfile).not.toHaveBeenCalled()
  })
})

describe('BuildingContractProfileService.save', () => {
  it('forbids managers', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.save(ev(), manager, 'b-1', {} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(findProfile).not.toHaveBeenCalled()
    expect(findBuilding).not.toHaveBeenCalled()
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
    expect(audit.metadata).toEqual({ changed_fields: ['lessor_id_number'] })
    expect(audit.before_data).toBeUndefined()
    expect(audit.after_data).toBeUndefined()
    expect(JSON.stringify(audit)).not.toContain('987654321')
    for (const value of [RAW_ID, row.lessor_date_of_birth, row.lessor_permanent_address]) expect(JSON.stringify(audit)).not.toContain(value)
  })
})

describe('BuildingContractProfileService.readiness', () => {
  it('uses unmasked data even for managers', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const r = await BuildingContractProfileService.readiness(ev(), manager, 'b-1')
    expect(r.contract.ready).toBe(true)
  })
})

describe('contract profile capability boundaries', () => {
  it.each(['admin', 'owner'] as const)('grants %s full profile access', (role) => {
    const user = { app_metadata: { role } } as AuthUser
    for (const capability of ['read', 'write', 'pii.read']) {
      expect(can(user, `building-contract-profile.${capability}`)).toBe(true)
    }
  })

  it('denies tenant and unauthenticated profile access', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    for (const role of ['tenant', null]) {
      const user = { app_metadata: { role } } as AuthUser
      await expect(BuildingContractProfileService.get(ev(), user, 'b-1')).rejects.toMatchObject({ statusCode: 403 })
      await expect(BuildingContractProfileService.save(ev(), user, 'b-1', {} as never)).rejects.toMatchObject({ statusCode: 403 })
      await expect(BuildingContractProfileService.readiness(ev(), user, 'b-1')).rejects.toMatchObject({ statusCode: 403 })
    }
    expect(findBuilding).not.toHaveBeenCalled()
    expect(findProfile).not.toHaveBeenCalled()
  })

  it.each(['get', 'save', 'readiness'] as const)('denies out-of-scope owner %s before sensitive access', async (operation) => {
    const statusCode = operation === 'save' ? 403 : 404
    assertBuildingScope.mockRejectedValue(Object.assign(new Error('outside scope'), { statusCode }))
    const { BuildingContractProfileService: service } = await import('../../../server/services/buildings/contract-profile')
    const result = operation === 'save' ? service.save(ev(), owner, 'b-1', {} as never) : service[operation](ev(), owner, 'b-1')
    await expect(result).rejects.toMatchObject({ statusCode })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', operation === 'save' ? 'write' : 'read')
    expect(findProfile).not.toHaveBeenCalled()
    expect(findInvoiceProfile).not.toHaveBeenCalled()
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(appendAudit).not.toHaveBeenCalled()
  })

  it('returns full data to admin and server-only consumers', async () => {
    const { BuildingContractProfileService: service } = await import('../../../server/services/buildings/contract-profile')
    const admin = { app_metadata: { role: 'admin' } } as AuthUser
    for (const result of [await service.get(ev(), admin, 'b-1'), await service.getUnmaskedForServer(ev(), 'b-1')]) {
      expect(result).toMatchObject({ lessorIdNumber: RAW_ID, lessorDateOfBirth: row.lessor_date_of_birth, lessorPermanentAddress: row.lessor_permanent_address, lessorIdentityMasked: false })
    }
  })

  it('returns null for absent profiles and missing readiness codes', async () => {
    findProfile.mockResolvedValue(null)
    const { BuildingContractProfileService: service } = await import('../../../server/services/buildings/contract-profile')
    expect(await service.get(ev(), manager, 'b-1')).toBeNull()
    expect(await service.getUnmaskedForServer(ev(), 'b-1')).toBeNull()
    expect((await service.readiness(ev(), manager, 'b-1')).contract.missing).toContain('lessor.id_number')
  })

  it('returns 404 for missing buildings without reading profiles', async () => {
    findBuilding.mockResolvedValue(null)
    const { BuildingContractProfileService: service } = await import('../../../server/services/buildings/contract-profile')
    await expect(service.get(ev(), owner, 'missing')).rejects.toMatchObject({ statusCode: 404 })
    expect(findProfile).not.toHaveBeenCalled()
  })

  it('allows partial first saves and audits only editable changed field names', async () => {
    const { BuildingContractProfileService: service } = await import('../../../server/services/buildings/contract-profile')
    const { buildingContractProfileSchema } = await import('~/utils/validators/building-contract-profile')
    const input = buildingContractProfileSchema.parse({ lessor_full_name: 'Nguyễn Văn A' })
    findProfile.mockResolvedValue(null)
    upsertProfile.mockResolvedValue({ ...row, ...input })
    expect(await service.save(ev(), owner, 'b-1', input)).toMatchObject({ lessorFullName: input.lessor_full_name, lessorIdNumber: null })
    expect(appendAudit.mock.calls[0]![2].metadata).toEqual({ changed_fields: ['lessor_full_name', 'signed_copies', 'copies_per_party'] })
  })

  it('does not audit equivalent numeric representations as changes', async () => {
    const { BuildingContractProfileService: service } = await import('../../../server/services/buildings/contract-profile')
    const { buildingContractProfileSchema } = await import('~/utils/validators/building-contract-profile')
    const input = buildingContractProfileSchema.parse(row)
    findProfile.mockResolvedValue({ ...row, default_deposit_months: '1', drilling_fee: '0' })
    upsertProfile.mockResolvedValue(row)
    await service.save(ev(), owner, 'b-1', input)
    expect(appendAudit.mock.calls[0]![2].metadata).toEqual({ changed_fields: [] })
  })
})
