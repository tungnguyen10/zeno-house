import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { SharedExpense } from '~/types/shared-expenses'
import { can as realCan } from '../../server/utils/permissions'

const listAll = vi.fn()
const listByOwner = vi.fn()
const findById = vi.fn()
const insertShared = vi.fn()
const updateShared = vi.fn()
const deactivateShared = vi.fn()
const allocateShared = vi.fn()
const assertBuildingScope = vi.fn()
const assertReportOpen = vi.fn()

vi.mock('../../server/repositories/shared-expenses', () => ({
  SharedExpenseRepository: {
    listAll,
    listByOwner,
    findById,
    insert: insertShared,
    update: updateShared,
    deactivate: deactivateShared,
    allocate: allocateShared,
  },
}))

vi.mock('../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../server/services/operations-report/locks', () => ({
  OperationsReportLockService: {
    assertReportOpen,
  },
}))

const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

const shared = (overrides: Partial<SharedExpense> = {}): SharedExpense => ({
  id: 'shared-1',
  ownerId: 'owner-1',
  name: 'Security',
  category: 'staff',
  amount: 1_001,
  note: null,
  isActive: true,
  buildingIds: ['building-1', 'building-2'],
  createdBy: 'owner-1',
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

describe('SharedExpenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    findById.mockResolvedValue(shared())
    assertBuildingScope.mockResolvedValue(undefined)
    assertReportOpen.mockResolvedValue(undefined)
    allocateShared.mockResolvedValue([
      { buildingId: 'building-1', expenseId: 'expense-1', amount: 500 },
      { buildingId: 'building-2', expenseId: 'expense-2', amount: 501 },
    ])
  })

  it('splits allocation evenly and absorbs rounding remainder into the last building', async () => {
    const { SharedExpenseService } = await import('../../server/services/shared-expenses')

    const result = await SharedExpenseService.allocate({} as never, owner, 'shared-1', {
      period_year: 2026,
      period_month: 7,
    })

    expect(allocateShared).toHaveBeenCalledWith(
      expect.anything(), 'shared-1', 2026, 7, 'owner-1',
    )
    expect(assertReportOpen).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 7)
    expect(assertReportOpen).toHaveBeenCalledWith(expect.anything(), 'building-2', 2026, 7)
    expect(result.generatedExpenses.map(row => row.amount)).toEqual([500, 501])
  })

  it('rejects duplicate allocation for the same period', async () => {
    allocateShared.mockRejectedValue({ statusCode: 409 })
    const { SharedExpenseService } = await import('../../server/services/shared-expenses')

    await expect(
      SharedExpenseService.allocate({} as never, owner, 'shared-1', {
        period_year: 2026,
        period_month: 7,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(allocateShared).toHaveBeenCalledTimes(1)
  })

  it('denies managers', async () => {
    const { SharedExpenseService } = await import('../../server/services/shared-expenses')

    await expect(
      SharedExpenseService.list({} as never, manager),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects out-of-scope member buildings before allocation creates expenses', async () => {
    assertBuildingScope.mockRejectedValueOnce({ statusCode: 403 })
    const { SharedExpenseService } = await import('../../server/services/shared-expenses')

    await expect(
      SharedExpenseService.allocate({} as never, owner, 'shared-1', {
        period_year: 2026,
        period_month: 7,
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(allocateShared).not.toHaveBeenCalled()
  })
})
