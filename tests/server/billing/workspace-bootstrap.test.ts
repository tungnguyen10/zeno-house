import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openOrGet: vi.fn(),
  grid: vi.fn(),
  utility: vi.fn(),
  overview: vi.fn(),
  invoices: vi.fn(),
  drafts: vi.fn(),
}))

vi.mock('../../../server/services/billing/periods', () => ({
  BillingPeriodService: { openOrGet: mocks.openOrGet, getOverview: mocks.overview },
}))
vi.mock('../../../server/services/billing/grid', () => ({ BillingDraftGridService: { getGrid: mocks.grid } }))
vi.mock('../../../server/services/billing/utility-usages', () => ({ BillingUtilityUsageService: { list: mocks.utility } }))
vi.mock('../../../server/services/billing/invoices', () => ({ InvoiceService: { list: mocks.invoices } }))
vi.mock('../../../server/services/billing/drafts', () => ({ BillingDraftService: { calculateDraft: mocks.drafts } }))

describe('BillingWorkspaceBootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.grid.mockResolvedValue({ rows: [] })
    mocks.utility.mockResolvedValue([])
    mocks.overview.mockResolvedValue({ period: { id: 'period-1' } })
    mocks.invoices.mockResolvedValue([])
    mocks.drafts.mockResolvedValue({ invoices: [] })
  })

  it('opens the period idempotently and loads the draft workspace in parallel', async () => {
    const period = { id: 'period-1', status: 'draft' }
    mocks.openOrGet.mockResolvedValue(period)
    const { BillingWorkspaceBootstrapService } = await import('../../../server/services/billing/workspace-bootstrap')

    await expect(BillingWorkspaceBootstrapService.get({} as never, {} as never, {
      building_id: 'toa-a', period_year: 2026, period_month: 7,
    })).resolves.toEqual({
      period,
      grid: { rows: [] },
      utilityUsages: [],
      overview: null,
      invoices: [],
      drafts: null,
    })
    expect(mocks.grid).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'period-1')
    expect(mocks.overview).not.toHaveBeenCalled()
  })

  it('loads collection data for an issued period', async () => {
    mocks.openOrGet.mockResolvedValue({ id: 'period-1', status: 'issued' })
    const { BillingWorkspaceBootstrapService } = await import('../../../server/services/billing/workspace-bootstrap')

    const result = await BillingWorkspaceBootstrapService.get({} as never, {} as never, {
      building_id: 'toa-a', period_year: 2026, period_month: 7,
    })

    expect(result.grid).toBeNull()
    expect(mocks.overview).toHaveBeenCalled()
    expect(mocks.invoices).toHaveBeenCalled()
    expect(mocks.drafts).toHaveBeenCalled()
  })
})
