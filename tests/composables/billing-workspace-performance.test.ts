import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
const useFetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useFetch', useFetchMock)
vi.stubGlobal('toValue', (value: unknown) => value)

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
    useFetchMock.mockReturnValue({
      data: ref(null), status: ref('success'), error: ref(null), refresh: vi.fn(),
    })
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

  it('hydrates workspace refs from bootstrap data without initial API calls', async () => {
    const { useBillingPeriodWorkspace } = await import('../../app/composables/billing/useBillingPeriodWorkspace')
    const initial = {
      period,
      grid: { rows: [], overview: { period } },
      utilityUsages: [],
      overview: null,
      invoices: [],
      drafts: null,
    } as never

    const workspace = useBillingPeriodWorkspace('period-1', initial)

    expect(workspace.period.value).toEqual(period)
    expect(workspace.grid.value).toMatchObject({ rows: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses a keyed SSR POST for idempotent workspace bootstrap', async () => {
    const { useBillingWorkspaceBootstrap } = await import('../../app/composables/billing/useBillingWorkspaceBootstrap')

    useBillingWorkspaceBootstrap('toa-a', 2026, 7)

    expect(useFetchMock).toHaveBeenCalledWith('/api/billing/workspace/bootstrap', expect.objectContaining({
      method: 'POST',
      key: 'billing-workspace:toa-a:2026-7',
      body: { building_id: 'toa-a', period_year: 2026, period_month: 7 },
    }))
  })

  it('does not fan out seeded workspace data when the tab watcher runs immediately', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/pages/dashboard/billing/[building]/[period].vue'),
      'utf8',
    )

    expect(page).toContain('watch(tab, async (current, previous) =>')
    expect(page).toContain('if (previous === undefined && bootstrap.value) return')
  })
})
