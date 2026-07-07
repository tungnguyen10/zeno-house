import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { PrepaidExpense } from '~/types/operations-report'

const findBuildingById = vi.fn()
const findById = vi.fn()
const listByBuilding = vi.fn()
const listActiveInPeriod = vi.fn()
const markExpiredBefore = vi.fn()
const insert = vi.fn()
const updateById = vi.fn()
const deleteById = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()
const canMock = vi.fn()
const assertNoClosedReportsInRange = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/repositories/operations-report/prepaid-expenses', () => ({
  PrepaidExpenseRepository: {
    findById,
    listByBuilding,
    listActiveInPeriod,
    markExpiredBefore,
    insert,
    updateById,
    deleteById,
  },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: appendAudit },
}))

vi.mock('../../../server/services/operations-report/locks', () => ({
  OperationsReportLockService: {
    assertNoClosedReportsInRange,
  },
}))

const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

function prepaid(overrides: Partial<PrepaidExpense> = {}): PrepaidExpense {
  return {
    id: 'prepaid-1',
    buildingId: 'building-1',
    name: 'Internet năm',
    category: 'internet',
    totalAmount: 1_000_000,
    totalMonths: 3,
    startDate: '2026-01-01',
    endDate: '2026-04-01',
    monthlyAmount: 333_333,
    status: 'active',
    receiptUrl: null,
    note: null,
    createdBy: 'owner-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('PrepaidExpenseService math', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', canMock)
    canMock.mockImplementation((user: AuthUser, capability: string) => {
      if (user.app_metadata.role === 'owner') return true
      if (user.app_metadata.role === 'manager') return capability === 'prepaid-expenses.read'
      return false
    })
    findBuildingById.mockResolvedValue({ id: 'building-1', name: 'Building 1' })
    findById.mockResolvedValue(prepaid())
    listByBuilding.mockResolvedValue([prepaid()])
    listActiveInPeriod.mockResolvedValue([prepaid()])
    markExpiredBefore.mockResolvedValue(undefined)
    insert.mockResolvedValue(prepaid())
    updateById.mockResolvedValue(prepaid({ name: 'Internet cập nhật' }))
    deleteById.mockResolvedValue(undefined)
    assertBuildingScope.mockResolvedValue(undefined)
    appendAudit.mockResolvedValue(undefined)
    assertNoClosedReportsInRange.mockResolvedValue(undefined)
  })

  it('computes end date and rounded monthly amount', async () => {
    const { computePrepaidFields } = await import(
      '../../../server/services/operations-report/prepaid-expenses'
    )

    expect(computePrepaidFields({
      total_amount: 1_000_000,
      total_months: 3,
      start_date: '2026-01-01',
    })).toEqual({
      end_date: '2026-04-01',
      monthly_amount: 333_333,
    })
  })

  it('absorbs rounding remainder in the final covered month', async () => {
    const { allocationForPeriod } = await import(
      '../../../server/services/operations-report/prepaid-expenses'
    )
    const item = prepaid()

    expect(allocationForPeriod(item, 2026, 1)).toBe(333_333)
    expect(allocationForPeriod(item, 2026, 2)).toBe(333_333)
    expect(allocationForPeriod(item, 2026, 3)).toBe(333_334)
    expect(
      allocationForPeriod(item, 2026, 1)
      + allocationForPeriod(item, 2026, 2)
      + allocationForPeriod(item, 2026, 3),
    ).toBe(1_000_000)
  })

  it('checks read scope when listing prepaid expenses', async () => {
    const { PrepaidExpenseService } = await import(
      '../../../server/services/operations-report/prepaid-expenses'
    )

    await PrepaidExpenseService.list({} as never, owner, { building_id: 'building-1' })

    expect(markExpiredBefore).toHaveBeenCalled()
    expect(findBuildingById).toHaveBeenCalledWith(expect.anything(), 'building-1')
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'building-1', 'read')
    expect(listByBuilding).toHaveBeenCalledWith(expect.anything(), 'building-1')
  })

  it('rejects manager prepaid configuration', async () => {
    const { PrepaidExpenseService } = await import(
      '../../../server/services/operations-report/prepaid-expenses'
    )

    await expect(
      PrepaidExpenseService.create({} as never, manager, {
        building_id: 'building-1',
        name: 'Internet năm',
        category: 'internet',
        total_amount: 1_200_000,
        total_months: 12,
        start_date: '2026-01-01',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(assertBuildingScope).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('checks write scope and audits create/update/delete', async () => {
    const { PrepaidExpenseService } = await import(
      '../../../server/services/operations-report/prepaid-expenses'
    )

    await PrepaidExpenseService.create({} as never, owner, {
      building_id: 'building-1',
      name: 'Internet năm',
      category: 'internet',
      total_amount: 1_200_000,
      total_months: 12,
      start_date: '2026-01-01',
    })
    await PrepaidExpenseService.update({} as never, owner, 'prepaid-1', {
      name: 'Internet cập nhật',
      total_amount: 900_000,
    })
    await PrepaidExpenseService.delete({} as never, owner, 'prepaid-1')

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'building-1', 'write')
    expect(insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        end_date: '2027-01-01',
        monthly_amount: 100_000,
        status: 'active',
      }),
      'owner-1',
    )
    expect(updateById).toHaveBeenCalledWith(
      expect.anything(),
      'prepaid-1',
      expect.objectContaining({
        end_date: '2026-04-01',
        monthly_amount: 300_000,
      }),
    )
    expect(deleteById).toHaveBeenCalledWith(expect.anything(), 'prepaid-1')
    expect(appendAudit).toHaveBeenCalledTimes(3)
  })
})
