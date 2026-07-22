import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildingGet: vi.fn(),
  invoiceProfileGet: vi.fn(),
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

vi.stubGlobal('can', (_user: unknown, capability: string) => !capability.endsWith('.write'))
vi.mock('../../../server/services/buildings', () => ({ BuildingService: { get: mocks.buildingGet } }))
vi.mock('../../../server/services/buildings/invoice-profile', () => ({ BuildingInvoiceProfileService: { get: mocks.invoiceProfileGet } }))
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
    mocks.buildingGet.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    mocks.invoiceProfileGet.mockResolvedValue(null)
    mocks.buildingServicesList.mockResolvedValue([])
    mocks.contractServicesList.mockResolvedValue([])
    mocks.catalogList.mockResolvedValue([])
    mocks.contractsList.mockResolvedValue({ items: [], total: 0 })
    mocks.managersList.mockResolvedValue([])
    mocks.fixedCostsList.mockResolvedValue([])
    mocks.reserveRatesList.mockResolvedValue([])
    mocks.recurringList.mockResolvedValue([])
    mocks.prepaidList.mockResolvedValue([])
  })

  it('loads the settings datasets behind one authenticated service call', async () => {
    const event = { context: {} } as never
    const user = { id: 'owner-1', app_metadata: { role: 'owner' } } as never
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')

    const result = await BuildingSettingsBootstrapService.get(event, user, 'toa-a')

    expect(result).toMatchObject({
      building: { id: 'building-1' },
      invoiceProfile: null,
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
})
