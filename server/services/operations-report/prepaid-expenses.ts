import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { PrepaidExpense, PrepaidExpenseAllocation } from '~/types/operations-report'
import type {
  PrepaidExpenseCreateInput,
  PrepaidExpenseListQuery,
  PrepaidExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { PrepaidExpenseRepository } from '../../repositories/operations-report/prepaid-expenses'
import { AuditService } from '../audit'
import { assertBuildingScope } from '../../utils/scope'

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

function addMonths(date: Date, months: number): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate())
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return utcDate(year!, month! - 1, day!)
}

function periodStart(periodYear: number, periodMonth: number): string {
  return dateOnly(utcDate(periodYear, periodMonth - 1, 1))
}

function today(): string {
  return dateOnly(new Date())
}

export function computePrepaidFields(input: {
  total_amount: number
  total_months: number
  start_date: string
}): { end_date: string, monthly_amount: number } {
  return {
    end_date: dateOnly(addMonths(parseDate(input.start_date), input.total_months)),
    monthly_amount: Math.round(input.total_amount / input.total_months),
  }
}

export function allocationForPeriod(item: PrepaidExpense, periodYear: number, periodMonth: number): number {
  const current = periodYear * 12 + periodMonth
  const start = parseDate(item.startDate)
  const finalMonth = start.getUTCFullYear() * 12 + start.getUTCMonth() + item.totalMonths
  if (current === finalMonth) {
    return item.totalAmount - item.monthlyAmount * (item.totalMonths - 1)
  }
  return item.monthlyAmount
}

async function requireBuilding(event: H3Event, buildingId: string) {
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

async function expireOldRows(event: H3Event) {
  await PrepaidExpenseRepository.markExpiredBefore(event, today())
}

export const PrepaidExpenseService = {
  async list(
    event: H3Event,
    user: AuthUser,
    query: PrepaidExpenseListQuery,
  ): Promise<PrepaidExpense[]> {
    if (!can(user, 'prepaid-expenses.read')) throwForbidden('Không có quyền xem chi phí trả trước')
    await expireOldRows(event)
    await requireBuilding(event, query.building_id)
    await assertBuildingScope(event, user, query.building_id, 'read')
    return PrepaidExpenseRepository.listByBuilding(event, query.building_id)
  },

  async listActiveAllocations(
    event: H3Event,
    buildingId: string,
    periodYearValue: number,
    periodMonthValue: number,
  ): Promise<PrepaidExpenseAllocation[]> {
    await expireOldRows(event)
    const items = await PrepaidExpenseRepository.listActiveInPeriod(
      event,
      buildingId,
      periodStart(periodYearValue, periodMonthValue),
    )
    return items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      monthlyAmount: allocationForPeriod(item, periodYearValue, periodMonthValue),
    }))
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: PrepaidExpenseCreateInput,
  ): Promise<PrepaidExpense> {
    if (!can(user, 'prepaid-expenses.write')) throwForbidden('Không có quyền cấu hình chi phí trả trước')
    await requireBuilding(event, input.building_id)
    await assertBuildingScope(event, user, input.building_id, 'write')

    const created = await PrepaidExpenseRepository.insert(
      event,
      { ...input, ...computePrepaidFields(input), status: 'active' },
      user.id,
    )

    await AuditService.append(event, user, {
      building_id: created.buildingId,
      action: AUDIT_ACTIONS.PREPAID_EXPENSE_CREATED,
      entity_type: 'prepaid_expense',
      entity_id: created.id,
      after_data: created,
    })

    return created
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: PrepaidExpenseUpdateInput,
  ): Promise<PrepaidExpense> {
    if (!can(user, 'prepaid-expenses.write')) throwForbidden('Không có quyền cấu hình chi phí trả trước')
    const existing = await PrepaidExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy chi phí trả trước')
    await assertBuildingScope(event, user, existing.buildingId, 'write')

    const totalAmount = input.total_amount ?? existing.totalAmount
    const totalMonths = input.total_months ?? existing.totalMonths
    const startDate = input.start_date ?? existing.startDate
    const shouldRecompute =
      input.total_amount !== undefined ||
      input.total_months !== undefined ||
      input.start_date !== undefined

    const updated = await PrepaidExpenseRepository.updateById(event, id, {
      ...input,
      ...(shouldRecompute && computePrepaidFields({
        total_amount: totalAmount,
        total_months: totalMonths,
        start_date: startDate,
      })),
    })

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.PREPAID_EXPENSE_UPDATED,
      entity_type: 'prepaid_expense',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return updated
  },

  async delete(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'prepaid-expenses.write')) throwForbidden('Không có quyền xóa chi phí trả trước')
    const existing = await PrepaidExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy chi phí trả trước')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    await PrepaidExpenseRepository.deleteById(event, id)
    await AuditService.append(event, user, {
      building_id: existing.buildingId,
      action: AUDIT_ACTIONS.PREPAID_EXPENSE_DELETED,
      entity_type: 'prepaid_expense',
      entity_id: existing.id,
      before_data: existing,
    })
  },
}
