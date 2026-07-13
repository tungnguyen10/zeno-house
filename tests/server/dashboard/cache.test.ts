import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSummary = vi.fn()
const getAssignedBuildingIds = vi.fn()

vi.mock('../../../server/repositories/dashboard', () => ({
  DashboardRepository: { getSummary },
}))
vi.mock('../../../server/utils/scope', () => ({ getAssignedBuildingIds }))

describe('DashboardService scope cache', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('can', vi.fn(() => true))
    const { clearDashboardSummaryCache } = await import('../../../server/services/dashboard')
    clearDashboardSummaryCache()
    getSummary.mockImplementation(async (_event, ids) => ({
      summary: { scope: ids },
      generatedAt: '2026-07-13T00:00:00Z',
    }))
  })

  it('reuses the same sorted scope and isolates different scopes', async () => {
    const { DashboardService } = await import('../../../server/services/dashboard')
    getAssignedBuildingIds
      .mockResolvedValueOnce(['building-b', 'building-a'])
      .mockResolvedValueOnce(['building-a', 'building-b'])
      .mockResolvedValueOnce(['building-c'])

    await DashboardService.getSummary({} as never, {} as never)
    await DashboardService.getSummary({} as never, {} as never)
    const third = await DashboardService.getSummary({} as never, {} as never)

    expect(getSummary).toHaveBeenCalledTimes(2)
    expect(third.data).toEqual({ scope: ['building-c'] })
  })
})
