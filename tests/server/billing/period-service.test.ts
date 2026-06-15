import { vi } from 'vitest'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findById = vi.fn()
const findByBuildingPeriod = vi.fn()
const insert = vi.fn()
const updateStatus = vi.fn()
const append = vi.fn()
const findBuildingByIdentifier = vi.fn()

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findById,
    findByBuildingPeriod,
    insert,
    updateStatus,
  },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: findBuildingByIdentifier,
  },
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {},
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    append,
  },
}))

describe('BillingPeriodService.advanceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a period by building slug through id-or-slug lookup', async () => {
    const created = buildPeriod({ buildingId: 'building-1', periodYear: 2026, periodMonth: 6 })
    findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    findByBuildingPeriod.mockResolvedValue(null)
    insert.mockResolvedValue(created)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.openOrGet(
      {} as never,
      { id: 'user-1' } as never,
      { building_id: 'toa-a', period_year: 2026, period_month: 6 },
    )

    expect(findBuildingByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(findByBuildingPeriod).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 6)
    expect(insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ building_id: 'building-1' }))
    expect(result.id).toBe(created.id)
  })

  it('updates status and appends an audit event', async () => {
    const period = buildPeriod({ status: 'draft' })
    const issued = buildPeriod({ status: 'issued', issuedAt: '2026-05-31T00:00:00.000Z' })
    findById.mockResolvedValue(period)
    updateStatus.mockResolvedValue(issued)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.advanceStatus({} as never, { id: 'user-1' } as never, period.id, 'issued')

    expect(result.status).toBe('issued')
    expect(updateStatus).toHaveBeenCalledWith(expect.anything(), period.id, 'issued', expect.objectContaining({ issued_at: expect.any(String) }))
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'period.status_changed',
      before_data: { status: 'draft' },
      after_data: { status: 'issued' },
    }))
  })

  it('blocks status changes from closed periods', async () => {
    findById.mockResolvedValue(buildPeriod({ status: 'closed' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.advanceStatus({} as never, { id: 'user-1' } as never, 'period-1', 'issued'))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(updateStatus).not.toHaveBeenCalled()
  })
})
