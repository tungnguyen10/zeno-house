import { vi } from 'vitest'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findById = vi.fn()
const updateStatus = vi.fn()
const append = vi.fn()

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findById,
    updateStatus,
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
