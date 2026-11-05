import { beforeEach, describe, expect, it, vi } from 'vitest'

const findAll = vi.fn()
const findByBuildingPeriod = vi.fn()
const closeBillingSystem = vi.fn()
const closeReportSystem = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findAll } }))
vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findByBuildingPeriod },
}))
vi.mock('../../../server/services/billing/periods', () => ({
  BillingPeriodService: { closeSystem: closeBillingSystem },
}))
vi.mock('../../../server/services/operations-report/report', () => ({
  OperationsReportService: { closeSystem: closeReportSystem },
}))

const period = { id: 'period-1', status: 'collecting' }

async function run() {
  const { runMonthEndClose } = await import('../../../server/services/billing/month-end-close')
  return runMonthEndClose({} as never, { year: 2026, month: 11 })
}

describe('runMonthEndClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findAll.mockResolvedValue({ items: [{ id: 'b1' }, { id: 'b2' }] })
    findByBuildingPeriod.mockResolvedValue(period)
    closeBillingSystem.mockResolvedValue({ status: 'closed', accrualStatus: 'recorded' })
    closeReportSystem.mockResolvedValue({ id: 'closure-1' })
  })

  it('reads only active buildings', async () => {
    await run()
    expect(findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: ['active'], buildingIds: null }))
  })

  it('closes the billing period before the operations report of each building', async () => {
    const order: string[] = []
    closeBillingSystem.mockImplementation(async () => {
      order.push('billing')
      return { status: 'closed', accrualStatus: 'recorded' }
    })
    closeReportSystem.mockImplementation(async (_event, input) => {
      order.push(`report:${input.building_id}`)
      return { id: 'closure-1' }
    })

    const result = await run()

    expect(order).toEqual(['billing', 'report:b1', 'billing', 'report:b2'])
    expect(findByBuildingPeriod).toHaveBeenCalledWith(expect.anything(), 'b1', 2026, 11)
    expect(closeReportSystem).toHaveBeenCalledWith(expect.anything(), { building_id: 'b1', period_year: 2026, period_month: 11 })
    expect(result.billingClosed).toBe(2)
    expect(result.reportsClosed).toBe(2)
  })

  it('skips a billing period that still has outstanding invoices but still closes the report', async () => {
    closeBillingSystem.mockResolvedValueOnce({ status: 'skipped', reason: 'has_outstanding', outstandingCount: 3 })

    const result = await run()

    expect(result.results[0]).toMatchObject({
      buildingId: 'b1',
      billing: { status: 'skipped', reason: 'has_outstanding', outstandingCount: 3 },
      report: { status: 'closed' },
    })
    expect(result.billingClosed).toBe(1)
    expect(closeReportSystem).toHaveBeenCalledTimes(2)
  })

  it('skips buildings that have no billing period for the month', async () => {
    findByBuildingPeriod.mockResolvedValueOnce(null)

    const result = await run()

    expect(result.results[0]!.billing).toEqual({ status: 'skipped', reason: 'no_period' })
    expect(closeBillingSystem).toHaveBeenCalledTimes(1)
    expect(closeReportSystem).toHaveBeenCalledTimes(2)
  })

  it('keeps going when a billing close fails and still attempts the report', async () => {
    closeBillingSystem.mockRejectedValueOnce(new Error('boom'))

    const result = await run()

    expect(result.results[0]!.billing).toEqual({ status: 'failed', message: 'boom' })
    expect(result.results[0]!.report.status).toBe('closed')
    expect(result.results[1]!.billing.status).toBe('closed')
  })

  it('keeps going when a report close fails', async () => {
    closeReportSystem.mockRejectedValueOnce(new Error('report failed'))

    const result = await run()

    expect(result.results[0]!.report).toEqual({ status: 'failed', message: 'report failed' })
    expect(result.results[1]!.report.status).toBe('closed')
    expect(result.reportsClosed).toBe(1)
  })
})
