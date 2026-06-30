import { vi } from 'vitest'
import { buildPeriod } from '../../__fixtures__/billing/period'

const period = buildPeriod({ id: 'period-1', buildingId: 'building-1', periodYear: 2026, periodMonth: 5 })
const listPeriods = vi.fn()
const findPeriodById = vi.fn()
const listInvoicesByPeriod = vi.fn()
const listUtilityUsagesByPeriod = vi.fn()

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    list: listPeriods,
    findById: findPeriodById,
  },
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    listByPeriod: listInvoicesByPeriod,
  },
}))

vi.mock('../../../server/repositories/billing/utility-usages', () => ({
  BillingUtilityUsageRepository: {
    listByPeriod: listUtilityUsagesByPeriod,
  },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: vi.fn(),
  },
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    listByPeriod: vi.fn(async () => []),
    append: vi.fn(),
  },
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(async () => createSupabaseMock()),
  serverSupabaseServiceRole: vi.fn(),
}))

interface QueryState {
  eq: Record<string, unknown>
}

function createQuery(table: string) {
  const state: QueryState = { eq: {} }
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      state.eq[column] = value
      return query
    }),
    lte: vi.fn(() => query),
    or: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(async () => {
      const data = resolveTable(table, state)
      return { data: Array.isArray(data) ? data[0] : data, error: null }
    }),
    then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
      return Promise.resolve({ data: resolveTable(table, state), error: null }).then(resolve, reject)
    },
  }
  return query
}

function resolveTable(table: string, state: QueryState) {
  if (table === 'buildings') {
    const building = {
      id: 'building-1',
      slug: 'building-one',
      name: 'Building One',
      electricity_pricing_type: 'per_kwh',
      default_electricity_rate: 4_000,
      water_pricing_type: 'per_person',
      default_water_rate: 40_000,
    }
    return state.eq.id ? building : [building]
  }
  if (table === 'contracts') {
    return [
      {
        id: 'contract-1',
        contract_code: 'HD-001',
        building_id: 'building-1',
        room_id: 'room-1',
        tenant_id: 'tenant-1',
        start_date: '2026-05-01',
        end_date: null,
        monthly_rent: 3_100_000,
        occupant_count: 2,
        discount_amount: 0,
        surcharge_amount: 0,
        payment_day: 5,
        status: 'active',
      },
      {
        id: 'contract-terminated',
        contract_code: 'HD-OLD',
        building_id: 'building-1',
        room_id: 'room-2',
        tenant_id: 'tenant-2',
        start_date: '2026-05-01',
        end_date: null,
        monthly_rent: 3_100_000,
        occupant_count: 1,
        discount_amount: 0,
        surcharge_amount: 0,
        payment_day: 5,
        status: 'terminated',
      },
    ]
  }
  if (table === 'contract_services' || table === 'contract_occupants') return []
  if (table === 'meter_readings') {
    if (state.eq.period_month === 4) {
      return [{ id: 'prev-electricity', room_id: 'room-1', meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 4, reading_value: 100, reading_date: '2026-04-30' }]
    }
    return [{ id: 'current-electricity', room_id: 'room-1', meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 5, reading_value: 125, reading_date: '2026-05-31' }]
  }
  if (table === 'rooms') {
    return [
      { id: 'room-1', room_number: '101', floor: 1, status: 'occupied' },
      { id: 'room-2', room_number: '102', floor: 1, status: 'occupied' },
    ]
  }
  if (table === 'tenants') {
    return [{ id: 'tenant-1', full_name: 'Tenant One' }]
  }
  return []
}

function createSupabaseMock() {
  return {
    from: vi.fn((table: string) => createQuery(table)),
  }
}

describe('billing API consistency regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPeriods.mockResolvedValue([period])
    findPeriodById.mockResolvedValue(period)
    listInvoicesByPeriod.mockResolvedValue([])
    listUtilityUsagesByPeriod.mockResolvedValue([])
  })

  it('keeps period list, overview, drafts, and draft grid aligned for one fixture', async () => {
    const [{ BillingPeriodService }, { BillingDraftService }, { BillingDraftGridService }] = await Promise.all([
      import('../../../server/services/billing/periods'),
      import('../../../server/services/billing/drafts'),
      import('../../../server/services/billing/grid'),
    ])

    const user = { id: 'user-1', app_metadata: { role: 'admin' } } as never
    const event = { context: {} } as never
    const [summary] = await BillingPeriodService.list(event, user, {})
    const overview = await BillingPeriodService.getOverview(event, user, period.id)
    const drafts = await BillingDraftService.calculateDraft(event, user, period.id)
    const grid = await BillingDraftGridService.getGrid(event, user, period.id)

    expect(summary).toMatchObject({
      contractCount: 1,
      readingCompleteCount: 1,
      readingRequiredCount: 1,
    })
    expect(overview).toMatchObject({
      contractCount: 1,
      readingCompleteCount: 1,
      readingRequiredCount: 1,
    })
    expect(drafts.drafts).toHaveLength(1)
    expect(drafts.drafts[0]).toMatchObject({
      contractId: 'contract-1',
      blockers: [],
    })
    expect(grid.rows.filter(row => row.rowType === 'billable_contract')).toHaveLength(1)
    expect(grid.totals).toMatchObject({
      requiredReadingCount: 1,
      completeReadingCount: 1,
    })
    expect(grid.overview).toMatchObject({
      contractCount: 1,
      readingCompleteCount: 1,
      readingRequiredCount: 1,
    })
  })
})
