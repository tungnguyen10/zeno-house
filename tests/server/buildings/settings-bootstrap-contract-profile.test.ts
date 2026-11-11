import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can } from '../../../server/utils/permissions'

const mocks = vi.hoisted(() => ({
  buildingGet: vi.fn(),
  invoiceProfileGet: vi.fn(),
  findBuilding: vi.fn(),
  findProfile: vi.fn(),
  findInvoiceProfile: vi.fn(),
  assertScope: vi.fn(),
  invoiceEmailSettingsGet: vi.fn(),
  buildingServicesList: vi.fn(),
  contractServicesList: vi.fn(),
  catalogList: vi.fn(),
  contractsList: vi.fn(),
  managersList: vi.fn(),
  fixedCostsList: vi.fn(),
  reserveRatesList: vi.fn(),
  recurringList: vi.fn(),
  prepaidList: vi.fn(),
}))

vi.mock('../../../server/services/buildings', () => ({ BuildingService: { get: mocks.buildingGet } }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: mocks.findBuilding } }))
vi.mock('../../../server/repositories/building-contract-profiles', () => ({
  BuildingContractProfileRepository: { findByBuildingId: mocks.findProfile },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { findByBuildingId: mocks.findInvoiceProfile },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.assertScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: vi.fn() } }))
vi.mock('../../../server/services/buildings/invoice-profile', () => ({ BuildingInvoiceProfileService: { get: mocks.invoiceProfileGet } }))
vi.mock('../../../server/services/buildings/invoice-email-settings', () => ({
  BuildingInvoiceEmailSettingsService: { get: mocks.invoiceEmailSettingsGet },
}))
vi.mock('../../../server/services/building-services', () => ({ BuildingServiceService: { list: mocks.buildingServicesList } }))
vi.mock('../../../server/services/contract-services', () => ({ ContractServiceService: { listByBuilding: mocks.contractServicesList } }))
vi.mock('../../../server/services/service-catalog', () => ({ ServiceCatalogService: { list: mocks.catalogList } }))
vi.mock('../../../server/services/contracts', () => ({ ContractService: { list: mocks.contractsList } }))
vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: { findManagersByBuilding: mocks.managersList } }))
vi.mock('../../../server/services/operations-report/fixed-costs', () => ({ BuildingFixedCostService: { list: mocks.fixedCostsList } }))
vi.mock('../../../server/services/operations-report/reserve-funds', () => ({ ReserveFundService: { listRates: mocks.reserveRatesList } }))
vi.mock('../../../server/services/operations-report/recurring-expenses', () => ({ RecurringExpenseService: { list: mocks.recurringList } }))
vi.mock('../../../server/services/operations-report/prepaid-expenses', () => ({ PrepaidExpenseService: { list: mocks.prepaidList } }))

const building = {
  id: 'building-1', slug: 'toa-a', billingGenerationDay: 1, paymentDueDay: 5,
  electricityPricingType: 'per_kwh', defaultElectricityRate: 3500,
  waterPricingType: 'per_m3', defaultWaterRate: 15000,
}
const row = {
  building_id: 'building-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi, Huế', lessor_id_number: '012345678901',
  lessor_id_issued_date: '2021-05-01', lessor_id_issued_place: 'Huế', lessor_phone: '0901234567',
  brand_name: null, default_term_months: 12, default_deposit_months: 1, notice_days: 30,
  deposit_refund_days: 7, renewal_months: 0, extra_occupant_fee: 0, drilling_fee: 0,
  fingerprint_reset_fee: 0, signed_copies: 2, copies_per_party: 1, updated_by: 'owner-1',
  created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', can)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { invoiceEmailEnabled: false } }))
  mocks.buildingGet.mockResolvedValue(building)
  mocks.findBuilding.mockResolvedValue(building)
  mocks.findProfile.mockResolvedValue(row)
  mocks.findInvoiceProfile.mockResolvedValue({ building_id: building.id })
  mocks.assertScope.mockResolvedValue(undefined)
  mocks.invoiceProfileGet.mockResolvedValue(null)
  mocks.invoiceEmailSettingsGet.mockResolvedValue(null)
  for (const list of [mocks.buildingServicesList, mocks.contractServicesList, mocks.catalogList,
    mocks.managersList, mocks.fixedCostsList, mocks.reserveRatesList, mocks.recurringList, mocks.prepaidList]) {
    list.mockResolvedValue([])
  }
  mocks.contractsList.mockResolvedValue({ items: [], total: 0 })
})

describe('settings bootstrap with real contract profile service', () => {
  it('serializes masked manager PII while deriving readiness from complete unmasked data', async () => {
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')
    const event = { context: {} } as never

    const result = await BuildingSettingsBootstrapService.get(event, manager, 'toa-a')

    expect(result.contractProfile).toMatchObject({
      lessorIdentityMasked: true, lessorIdNumber: '*******8901',
      lessorDateOfBirth: null, lessorPermanentAddress: null,
    })
    const serialized = JSON.stringify(result)
    for (const value of [row.lessor_id_number, row.lessor_date_of_birth, row.lessor_permanent_address]) {
      expect(serialized).not.toContain(value)
    }
    expect(result.readiness).toEqual({
      contract: { ready: true, missing: [] }, billing: { ready: true, missing: [] },
    })
    expect(mocks.assertScope).toHaveBeenCalledWith(event, manager, building.id, 'read')
  })

  it('reports missing source identity data without exposing the remaining PII', async () => {
    mocks.findProfile.mockResolvedValue({ ...row, lessor_date_of_birth: null })
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')

    const result = await BuildingSettingsBootstrapService.get({ context: {} } as never, manager, 'toa-a')

    expect(result.readiness.contract).toEqual({ ready: false, missing: ['lessor.date_of_birth'] })
    expect(result.contractProfile?.lessorDateOfBirth).toBeNull()
    expect(JSON.stringify(result)).not.toContain(row.lessor_id_number)
    expect(JSON.stringify(result)).not.toContain(row.lessor_permanent_address)
  })
})
