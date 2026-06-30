import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can } from '../../../server/utils/permissions'
import { DashboardService } from '../../../server/services/dashboard'

const getSummary = vi.hoisted(() => vi.fn(async () => ({
  summary: {
    buildings: { total: 0 },
    rooms: { total: 0, available: 0, occupied: 0, maintenance: 0 },
    tenants: { total: 0 },
    contracts: { active: 0, expiringSoon: 0, expiringUrgent: 0 },
    billing: {
      currentMonth: {
        period: '2026-06',
        invoiceTotal: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueAmount: 0,
        collectionRate: 0,
      },
    },
    buildingBreakdown: [],
    billingTrend: [],
    revenueBreakdown: { totalIssued: 0, totalPaid: 0, categories: [] },
    pendingOperations: [],
  },
  generatedAt: '2026-06-25T10:00:00.000Z',
})))

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
}))

vi.mock('../../../server/repositories/dashboard', () => ({
  DashboardRepository: {
    getSummary,
  },
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

function makeUser(role: 'admin' | 'manager' | null): AuthUser {
  return { id: `${role ?? 'none'}-user`, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('DashboardService permission gate', () => {
  beforeEach(() => {
    // Use real permission resolver instead of the test-setup global stub
    vi.stubGlobal('can', can)
    vi.clearAllMocks()
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
  })

  it('admin can read dashboard', async () => {
    const result = await DashboardService.getSummary(event(), makeUser('admin'))
    expect(result.data.buildings.total).toBe(0)
    expect(result.meta.generatedAt).toBe('2026-06-25T10:00:00.000Z')
    expect(getSummary).toHaveBeenCalledWith(expect.anything(), null)
  })

  it('manager can read dashboard', async () => {
    const result = await DashboardService.getSummary(event(), makeUser('manager'))
    expect(result.meta.generatedAt).toBe('2026-06-25T10:00:00.000Z')
    expect(getSummary).toHaveBeenCalledWith(expect.anything(), ['building-1'])
  })

  it('user without role gets FORBIDDEN', async () => {
    await expect(DashboardService.getSummary(event(), makeUser(null))).rejects.toMatchObject({
      statusCode: 403,
      data: { error: { code: 'FORBIDDEN' } },
    })
  })
})
