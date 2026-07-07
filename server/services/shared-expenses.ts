import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { SharedExpense, SharedExpenseAllocationResult } from '~/types/shared-expenses'
import type {
  SharedExpenseAllocateInput,
  SharedExpenseCreateInput,
  SharedExpenseUpdateInput,
} from '~/utils/validators/shared-expenses'
import { BuildingExpenseRepository } from '../repositories/operations-report/expenses'
import { SharedExpenseRepository } from '../repositories/shared-expenses'
import { OperationsReportLockService } from './operations-report/locks'
import { assertBuildingScope } from '../utils/scope'

function ownerScopeId(user: AuthUser): string {
  return isAdmin(user) ? user.id : user.id
}

async function assertOwnerOfSharedExpense(expense: SharedExpense, user: AuthUser) {
  if (isAdmin(user)) return
  if (expense.ownerId !== user.id) throwForbidden('Không có quyền thao tác chi phí dùng chung')
}

async function assertEveryBuildingInScope(
  event: H3Event,
  user: AuthUser,
  buildingIds: string[],
) {
  for (const buildingId of buildingIds) {
    await assertBuildingScope(event, user, buildingId, 'write')
  }
}

function splitEvenly(amount: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(amount / count)
  const shares = Array.from({ length: count }, () => base)
  const last = shares.length - 1
  shares[last] = (shares[last] ?? 0) + amount - base * count
  return shares
}

export const SharedExpenseService = {
  async list(event: H3Event, user: AuthUser): Promise<SharedExpense[]> {
    if (!can(user, 'shared-expenses.read')) throwForbidden('Không có quyền xem chi phí dùng chung')
    return isAdmin(user)
      ? SharedExpenseRepository.listAll(event)
      : SharedExpenseRepository.listByOwner(event, ownerScopeId(user))
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: SharedExpenseCreateInput,
  ): Promise<SharedExpense> {
    if (!can(user, 'shared-expenses.write')) throwForbidden('Không có quyền tạo chi phí dùng chung')
    await assertEveryBuildingInScope(event, user, input.building_ids)
    return SharedExpenseRepository.insert(event, ownerScopeId(user), input, user.id)
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: SharedExpenseUpdateInput,
  ): Promise<SharedExpense> {
    if (!can(user, 'shared-expenses.write')) throwForbidden('Không có quyền sửa chi phí dùng chung')
    const existing = await SharedExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy chi phí dùng chung')
    await assertOwnerOfSharedExpense(existing, user)
    if (input.building_ids) await assertEveryBuildingInScope(event, user, input.building_ids)
    return SharedExpenseRepository.update(event, id, input)
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'shared-expenses.write')) throwForbidden('Không có quyền xóa chi phí dùng chung')
    const existing = await SharedExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy chi phí dùng chung')
    await assertOwnerOfSharedExpense(existing, user)
    await SharedExpenseRepository.deactivate(event, id)
  },

  async allocate(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: SharedExpenseAllocateInput,
  ): Promise<SharedExpenseAllocationResult> {
    if (!can(user, 'shared-expenses.allocate')) {
      throwForbidden('Không có quyền phân bổ chi phí dùng chung')
    }
    const expense = await SharedExpenseRepository.findById(event, id)
    if (!expense || !expense.isActive) throwNotFound('Không tìm thấy chi phí dùng chung')
    await assertOwnerOfSharedExpense(expense, user)
    if (expense.buildingIds.length === 0) throwValidationError('Cần ít nhất một tòa nhà để phân bổ')
    await assertEveryBuildingInScope(event, user, expense.buildingIds)
    for (const buildingId of expense.buildingIds) {
      await OperationsReportLockService.assertReportOpen(
        event,
        buildingId,
        input.period_year,
        input.period_month,
      )
    }

    const alreadyAllocated = await SharedExpenseRepository.hasAllocation(
      event,
      id,
      input.period_year,
      input.period_month,
    )
    if (alreadyAllocated) throwConflict('Kỳ này đã được phân bổ')

    const marker = `[shared:${id}:${input.period_year}-${String(input.period_month).padStart(2, '0')}]`
    const shares = splitEvenly(expense.amount, expense.buildingIds.length)
    const generatedExpenses = []
    for (const [index, buildingId] of expense.buildingIds.entries()) {
      const created = await BuildingExpenseRepository.insert(event, {
        building_id: buildingId,
        period_year: input.period_year,
        period_month: input.period_month,
        expense_date: null,
        category: expense.category,
        amount: shares[index]!,
        note: `${marker} ${expense.name}`,
        payee: null,
        payment_method: null,
        funded_by: 'direct',
      }, user.id)
      generatedExpenses.push({
        buildingId,
        expenseId: created.id,
        amount: created.amount,
      })
    }

    return {
      sharedExpenseId: id,
      periodYear: input.period_year,
      periodMonth: input.period_month,
      generatedExpenses,
    }
  },
}
