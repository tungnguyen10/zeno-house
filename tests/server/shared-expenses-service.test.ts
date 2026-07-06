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
const hasAllocation = vi.fn()
const insertExpense = vi.fn()
const assertBuildingScope = vi.fn()

vi.mock('../../server/repositories/shared-expenses', () => ({
  SharedExpenseRepository: {
    listAll,
    listByOwner,
    findById,
    insert: insertShared,
    update: updateShared,
    deactivate: deactivateShared,
    hasAllocation,
  },
}))

vi.mock('../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: { insert: insertExpense },
}))

vi.mock('../../server/utils/scope', () => ({
  assertBuildingScope,
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
    hasAllocation.mockResolvedValue(false)
    assertBuildingScope.mockResolvedValue(undefined)
    insertExpense
      .mockResolvedValueOnce({ id: 'expense-1', amount: 500 })
      .mockResolvedValueOnce({ id: 'expense-2', amount: 501 })
  })

  it('splits allocation evenly and absorbs rounding remainder into the last building', async () => {
    const { SharedExpenseService } = await import('../../server/services/shared-expenses')

    const result = await SharedExpenseService.allocate({} as never, owner, 'shared-1', {
      period_year: 2026,
      period_month: 7,
    })

    expect(insertExpense).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      building_id: 'building-1',
      amount: 500,
    }), 'owner-1')
    expect(insertExpense).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
      building_id: 'building-2',
      amount: 501,
    }), 'owner-1')
    expect(result.generatedExpenses.map(row => row.amount)).toEqual([500, 501])
  })

  it('rejects duplicate allocation for the same period', async () => {
    hasAllocation.mockResolvedValue(true)
    const { SharedExpenseService } = await import('../../server/services/shared-expenses')

    await expect(
      SharedExpenseService.allocate({} as never, owner, 'shared-1', {
        period_year: 2026,
        period_month: 7,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(insertExpense).not.toHaveBeenCalled()
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
    expect(insertExpense).not.toHaveBeenCalled()
  })
})
