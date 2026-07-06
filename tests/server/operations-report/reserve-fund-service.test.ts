import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense, ReserveFund } from '~/types/operations-report'
import { can as realCan } from '../../../server/utils/permissions'

const findBuildingById = vi.fn()
const assertBuildingScope = vi.fn()
const findOrCreateByBuilding = vi.fn()
const getFundByBuilding = vi.fn()
const insertTransaction = vi.fn()
const insertExpense = vi.fn()
const voidExpenseById = vi.fn()
const deleteExpenseById = vi.fn()
const findWithdrawalByExpense = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/repositories/operations-report/reserve-funds', () => ({
  ReserveFundRepository: {
    findOrCreateByBuilding,
    getByBuilding: getFundByBuilding,
    insertTransaction,
    findWithdrawalByExpense,
  },
}))

vi.mock('../../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: {
    insert: insertExpense,
    voidById: voidExpenseById,
    deleteById: deleteExpenseById,
  },
}))

const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

const fund = (balance: number): ReserveFund => ({
  id: 'fund-1',
  buildingId: 'building-1',
  balance,
  createdAt: '2026-07-05T00:00:00Z',
  transactions: [],
})

const expense = (overrides: Partial<BuildingExpense> = {}): BuildingExpense => ({
  id: 'expense-1',
  buildingId: 'building-1',
  periodYear: 2026,
  periodMonth: 7,
  expenseDate: '2026-07-05',
  category: 'repair',
  amount: 300,
  payee: null,
  paymentMethod: null,
  note: null,
  fundedBy: 'reserve_fund',
  receiptUrl: null,
  receiptSignedUrl: null,
  createdBy: 'owner-1',
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  createdAt: '2026-07-05T00:00:00Z',
  updatedAt: '2026-07-05T00:00:00Z',
  ...overrides,
})

describe('ReserveFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    findBuildingById.mockResolvedValue({ id: 'building-1' })
    assertBuildingScope.mockResolvedValue(undefined)
    findOrCreateByBuilding.mockResolvedValue({ id: 'fund-1', building_id: 'building-1', created_at: '' })
    getFundByBuilding.mockResolvedValue(fund(1_000))
    insertTransaction.mockResolvedValue({ id: 'tx-1' })
    insertExpense.mockResolvedValue(expense())
    voidExpenseById.mockResolvedValue(expense({ voidedAt: '2026-07-05T00:00:00Z' }))
    deleteExpenseById.mockResolvedValue(undefined)
  })

  it('rejects withdrawals that would make the balance negative', async () => {
    getFundByBuilding.mockResolvedValue(fund(100))
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await expect(
      ReserveFundService.withdraw({} as never, owner, 'building-1', {
        amount: 200,
        date: '2026-07-05',
      }),
    ).rejects.toMatchObject({ statusCode: 422 })
    expect(insertTransaction).not.toHaveBeenCalled()
  })

  it('creates a reserve-funded expense and linked withdrawal', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.createReserveFundedExpense({} as never, owner, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 7,
      expense_date: '2026-07-05',
      category: 'repair',
      amount: 300,
      note: 'repair',
      funded_by: 'reserve_fund',
    })

    expect(insertExpense).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      funded_by: 'reserve_fund',
    }), 'owner-1')
    expect(insertTransaction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      fundId: 'fund-1',
      type: 'withdrawal',
      amount: 300,
      linkedExpenseId: 'expense-1',
    }))
  })

  it('deletes the newly created expense when linked withdrawal creation fails', async () => {
    insertTransaction.mockRejectedValueOnce(new Error('ledger write failed'))
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await expect(
      ReserveFundService.createReserveFundedExpense({} as never, owner, {
        building_id: 'building-1',
        period_year: 2026,
        period_month: 7,
        expense_date: '2026-07-05',
        category: 'repair',
        amount: 300,
        note: 'repair',
        funded_by: 'reserve_fund',
      }),
    ).rejects.toThrow('ledger write failed')
    expect(deleteExpenseById).toHaveBeenCalledWith(expect.anything(), 'expense-1')
    expect(voidExpenseById).not.toHaveBeenCalled()
  })

  it('denies managers access to reserve fund movements', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await expect(
      ReserveFundService.withdraw({} as never, manager, 'building-1', {
        amount: 100,
        date: '2026-07-05',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(insertTransaction).not.toHaveBeenCalled()
  })

  it('adds a deposit reversal when voiding a reserve-funded expense', async () => {
    findWithdrawalByExpense.mockResolvedValue({
      id: 'withdrawal-1',
      fundId: 'fund-1',
      type: 'withdrawal',
      amount: 300,
      date: '2026-07-05',
      linkedExpenseId: 'expense-1',
      note: null,
      createdBy: 'owner-1',
      createdAt: '',
    })
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.reverseExpenseWithdrawal({} as never, owner, expense())

    expect(insertTransaction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      fundId: 'fund-1',
      type: 'deposit',
      amount: 300,
      linkedExpenseId: 'expense-1',
    }))
  })
})
