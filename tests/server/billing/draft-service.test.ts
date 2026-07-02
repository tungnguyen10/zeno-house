import { vi } from 'vitest'
import { buildPeriod } from '../../__fixtures__/billing/period'

const listByPeriod = vi.fn()
const listInvoicesByPeriod = vi.fn()
const findPeriodById = vi.fn()
let meterReadingCall = 0

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
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
    listByPeriod,
  },
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(async () => createSupabaseMock()),
  serverSupabaseServiceRole: vi.fn(() => createSupabaseMock()),
}))

function createQuery(table: string) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: resolveTable(table), error: null })),
    then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
      return Promise.resolve({ data: resolveTable(table), error: null }).then(resolve, reject)
    },
  }
}

function resolveTable(table: string) {
  if (table === 'buildings') {
    return {
      id: 'building-1',
      name: 'Building',
      electricity_pricing_type: 'per_kwh',
      default_electricity_rate: 4_000,
      water_pricing_type: 'per_m3',
      default_water_rate: 15_000,
    }
  }
  if (table === 'contracts') {
    return [{
      id: 'contract-1',
      building_id: 'building-1',
      room_id: 'room-1',
      tenant_id: 'tenant-1',
      start_date: '2026-05-16',
      end_date: null,
      monthly_rent: 3_100_000,
      occupant_count: 2,
      discount_amount: 100_000,
      surcharge_amount: 0,
      payment_day: 5,
      status: 'active',
    }]
  }
  if (table === 'contract_services' || table === 'contract_occupants') return []
  if (table === 'meter_readings') {
    meterReadingCall += 1
    if (meterReadingCall === 1) {
      return [
        { id: 'current-electricity', room_id: 'room-1', meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 5, reading_value: 125 },
        { id: 'current-water', room_id: 'room-1', meter_type: 'water', reading_type: 'monthly', period_year: 2026, period_month: 5, reading_value: 18 },
      ]
    }
    if (meterReadingCall === 2) {
      return [
        { id: 'previous-electricity', room_id: 'room-1', meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 4, reading_value: 100 },
        { id: 'previous-water', room_id: 'room-1', meter_type: 'water', reading_type: 'monthly', period_year: 2026, period_month: 4, reading_value: 10 },
      ]
    }
    return []
  }
  if (table === 'rooms') return [{ id: 'room-1', room_number: '101' }]
  if (table === 'tenants') return [{ id: 'tenant-1', full_name: 'Tenant One' }]
  return []
}

function createSupabaseMock() {
  return {
    from: vi.fn((table: string) => createQuery(table)),
  }
}

describe('BillingDraftService.calculateDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    meterReadingCall = 0
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', buildingId: 'building-1', periodYear: 2026, periodMonth: 5 }))
    listByPeriod.mockResolvedValue([])
    listInvoicesByPeriod.mockResolvedValue([])
  })

  it('calculates production draft rows with prorated rent, utilities, and discount', async () => {
    const { BillingDraftService } = await import('../../../server/services/billing/drafts')

    const result = await BillingDraftService.calculateDraft({} as never, { id: 'user-1', app_metadata: { role: 'admin' } } as never, 'period-1')

    expect(result.drafts).toHaveLength(1)
    const [draft] = result.drafts
    expect(draft?.subtotalAmount).toBe(1_820_000)
    expect(draft?.discountAmount).toBe(100_000)
    expect(draft?.totalAmount).toBe(1_720_000)
    expect(draft?.lines.find(line => line.chargeType === 'rent')).toMatchObject({
      amount: 1_600_000,
      metadata: { billable_days: 16, period_days: 31 },
    })
    expect(draft?.lines.find(line => line.chargeType === 'electricity')).toMatchObject({
      quantity: 25,
      amount: 100_000,
    })
    expect(draft?.lines.find(line => line.chargeType === 'water')).toMatchObject({
      quantity: 8,
      amount: 120_000,
    })
  })
})
