import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildingGet: vi.fn(),
  invoiceProfileGet: vi.fn(),
  contractProfileGet: vi.fn(),
  contractReadiness: vi.fn(),
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
vi.mock('../../../server/services/buildings/contract-profile', () => ({
  BuildingContractProfileService: { get: mocks.contractProfileGet, readiness: mocks.contractReadiness },
}))
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

describe('BuildingSettingsBootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', (_user: unknown, capability: string) => !capability.endsWith('.write'))
    mocks.contractProfileGet.mockResolvedValue(null)
    mocks.contractReadiness.mockResolvedValue({ contract: { ready: false, missing: ['invoice_profile'] }, billing: { ready: true, missing: [] } })
    mocks.buildingGet.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    mocks.invoiceProfileGet.mockResolvedValue(null)
    mocks.invoiceEmailSettingsGet.mockResolvedValue({
      buildingId: 'building-1',
      autoSendEnabled: false,
      featureAvailable: false,
      updatedAt: null,
      updatedBy: null,
    })
    mocks.buildingServicesList.mockResolvedValue([])
    mocks.contractServicesList.mockResolvedValue([])
    mocks.catalogList.mockResolvedValue([])
    mocks.contractsList.mockResolvedValue({ items: [], total: 0 })
    mocks.managersList.mockResolvedValue([])
    mocks.fixedCostsList.mockResolvedValue([])
    mocks.reserveRatesList.mockResolvedValue([])
    mocks.recurringList.mockResolvedValue([])
    mocks.prepaidList.mockResolvedValue([])
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { invoiceEmailEnabled: false },
    }))
  })

  it('loads the settings datasets behind one authenticated service call', async () => {
    const event = { context: {} } as never
    const user = { id: 'owner-1', app_metadata: { role: 'owner' } } as never
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')

    const result = await BuildingSettingsBootstrapService.get(event, user, 'toa-a')

    expect(result).toMatchObject({
      building: { id: 'building-1' },
      invoiceProfile: null,
      contractProfile: null,
      readiness: { contract: { ready: false, missing: ['invoice_profile'] }, billing: { ready: true, missing: [] } },
      invoiceEmailAvailable: false,
      invoiceEmailSettings: {
        buildingId: 'building-1',
        autoSendEnabled: false,
        featureAvailable: false,
      },
      buildingServices: [],
      contractServices: [],
      catalog: [],
      contracts: [],
      managers: [],
      fixedCosts: [],
      reserveRates: [],
      recurringExpenses: [],
      prepaidExpenses: [],
    })
    expect(mocks.contractsList).toHaveBeenCalledWith(event, user, expect.objectContaining({
      building_id: 'building-1', status: ['active'], page: 1, limit: 200,
    }))
  })

  it('includes the service-masked contract profile and readiness for managers', async () => {
    const event = { context: {} } as never
    const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as never
    mocks.contractProfileGet.mockResolvedValue({
      buildingId: 'building-1', lessorIdNumber: '*******8901', lessorIdentityMasked: true,
      lessorDateOfBirth: null, lessorPermanentAddress: null,
    })
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')

    const result = await BuildingSettingsBootstrapService.get(event, manager, 'toa-a')

    expect(result.contractProfile).toMatchObject({ lessorIdentityMasked: true, lessorIdNumber: '*******8901' })
    expect(result.readiness.contract).toEqual({ ready: false, missing: ['invoice_profile'] })
    expect(JSON.stringify(result)).not.toContain('012345678901')
    expect(mocks.contractProfileGet).toHaveBeenCalledWith(event, manager, 'building-1')
    expect(mocks.contractReadiness).toHaveBeenCalledWith(event, manager, 'building-1')
  })

  it('skips the contract profile when the caller cannot read it', async () => {
    vi.stubGlobal('can', (_user: unknown, capability: string) => capability !== 'building-contract-profile.read')
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')

    const result = await BuildingSettingsBootstrapService.get({ context: {} } as never, {} as never, 'toa-a')

    expect(mocks.contractProfileGet).not.toHaveBeenCalled()
    expect(result.contractProfile).toBeNull()
    expect(mocks.contractReadiness).toHaveBeenCalledOnce()
  })

  it('preserves initial building authorization failures before loading settings', async () => {
    mocks.buildingGet.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')

    await expect(BuildingSettingsBootstrapService.get({ context: {} } as never, {} as never, 'toa-a'))
      .rejects.toMatchObject({ statusCode: 403 })

    expect(mocks.contractProfileGet).not.toHaveBeenCalled()
    expect(mocks.contractReadiness).not.toHaveBeenCalled()
    expect(mocks.invoiceProfileGet).not.toHaveBeenCalled()
  })
})
