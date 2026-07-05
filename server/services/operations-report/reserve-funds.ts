import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense, ReserveFund, ReserveFundTransaction } from '~/types/operations-report'
import type { BuildingExpenseCreateInput, ReserveFundMovementInput } from '~/utils/validators/operations-report'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingExpenseRepository } from '../../repositories/operations-report/expenses'
import { ReserveFundRepository } from '../../repositories/operations-report/reserve-funds'
import { assertBuildingScope } from '../../utils/scope'

async function requireBuildingAccess(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
  capability: string,
  mode: 'read' | 'write',
) {
  if (!can(user, capability)) throwForbidden('Không có quyền thao tác quỹ dự phòng')
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  await assertBuildingScope(event, user, buildingId, mode)
}

export const ReserveFundService = {
  async get(event: H3Event, user: AuthUser, buildingId: string): Promise<ReserveFund> {
    await requireBuildingAccess(event, user, buildingId, 'reserve-fund.read', 'read')
    return ReserveFundRepository.getByBuilding(event, buildingId)
  },

  async deposit(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
    input: ReserveFundMovementInput,
  ): Promise<ReserveFund> {
    await requireBuildingAccess(event, user, buildingId, 'reserve-fund.deposit', 'write')
    const fund = await ReserveFundRepository.findOrCreateByBuilding(event, buildingId)
    await ReserveFundRepository.insertTransaction(event, {
      fundId: fund.id,
      type: 'deposit',
      amount: input.amount,
      date: input.date,
      note: input.note,
      createdBy: user.id,
    })
    return ReserveFundRepository.getByBuilding(event, buildingId)
  },

  async withdraw(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
    input: ReserveFundMovementInput,
  ): Promise<ReserveFund> {
    await requireBuildingAccess(event, user, buildingId, 'reserve-fund.withdraw', 'write')
    const fund = await ReserveFundRepository.getByBuilding(event, buildingId)
    if (fund.balance < input.amount) throwValidationError('Số dư quỹ không đủ')
    await ReserveFundRepository.insertTransaction(event, {
      fundId: fund.id,
      type: 'withdrawal',
      amount: input.amount,
      date: input.date,
      note: input.note,
      createdBy: user.id,
    })
    return ReserveFundRepository.getByBuilding(event, buildingId)
  },

  async createReserveFundedExpense(
    event: H3Event,
    user: AuthUser,
    input: BuildingExpenseCreateInput,
  ): Promise<BuildingExpense> {
    await requireBuildingAccess(event, user, input.building_id, 'reserve-fund.withdraw', 'write')
    const fund = await ReserveFundRepository.getByBuilding(event, input.building_id)
    if (fund.balance < input.amount) throwValidationError('Số dư quỹ không đủ')

    const created = await BuildingExpenseRepository.insert(
      event,
      { ...input, funded_by: 'reserve_fund' },
      user.id,
    )
    try {
      await ReserveFundRepository.insertTransaction(event, {
        fundId: fund.id,
        type: 'withdrawal',
        amount: input.amount,
        date: input.expense_date ?? new Date().toISOString().slice(0, 10),
        note: input.note ?? `Expense ${created.id}`,
        linkedExpenseId: created.id,
        createdBy: user.id,
      })
    }
    catch (error) {
      await BuildingExpenseRepository.voidById(
        event,
        created.id,
        user.id,
        'Reserve withdrawal failed',
      )
      throw error
    }
    return created
  },

  async reverseExpenseWithdrawal(
    event: H3Event,
    user: AuthUser,
    expense: BuildingExpense,
  ): Promise<ReserveFundTransaction | null> {
    if (expense.fundedBy !== 'reserve_fund') return null
    const withdrawal = await ReserveFundRepository.findWithdrawalByExpense(event, expense.id)
    if (!withdrawal) return null
    return ReserveFundRepository.insertTransaction(event, {
      fundId: withdrawal.fundId,
      type: 'deposit',
      amount: withdrawal.amount,
      date: new Date().toISOString().slice(0, 10),
      note: `Reverse voided expense ${expense.id}`,
      linkedExpenseId: expense.id,
      createdBy: user.id,
    })
  },
}
