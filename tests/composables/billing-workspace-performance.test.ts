import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

const period = {
  id: 'period-1',
  buildingId: 'building-1',
  periodYear: 2026,
  periodMonth: 7,
  status: 'open',
}

function responseFor(url: string) {
  if (url.endsWith('/issue')) return { data: { issued: 1, skipped: [] } }
  if (url.endsWith('/utility-usages')) {
    return { data: { id: 'usage-1', approvedBy: null } }
  }
  if (url.endsWith('/invoices')) return { data: [] }
  if (url.endsWith('/audit')) return { data: [] }
  if (url.endsWith('/draft-grid')) {
    return { data: { rows: [], overview: { period } } }
  }
  return { data: period }
}

describe('billing workspace request dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockImplementation(async (url: string) => responseFor(url))
  })

  it('issues invoices with one invoice reload and one grid reload', async () => {
    const { useBillingPeriodWorkspace } = await import('../../app/composables/billing/useBillingPeriodWorkspace')
    const workspace = useBillingPeriodWorkspace('period-1')

    await workspace.issue({} as never)

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      '/api/billing/periods/period-1/issue',
      '/api/billing/periods/period-1/invoices',
      '/api/billing/periods/period-1/draft-grid',
    ])
  })

  it('updates utility usage locally and reloads only the grid', async () => {
    const { useBillingPeriodWorkspace } = await import('../../app/composables/billing/useBillingPeriodWorkspace')
    const workspace = useBillingPeriodWorkspace('period-1')

    await workspace.saveUtilityOverride({} as never)

    expect(workspace.utilityUsages.value).toHaveLength(1)
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      '/api/billing/periods/period-1/utility-usages',
      '/api/billing/periods/period-1/draft-grid',
    ])
  })
})
