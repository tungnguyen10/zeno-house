import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  RecurringExpense,
  RecurringExpenseRecordPrefill,
} from '~/types/operations-report'
import type {
  RecurringExpenseActionInput,
  RecurringExpenseCreateInput,
  RecurringExpenseListQuery,
  RecurringExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import type { RecurringExpenseFrequency } from '~/utils/constants/operations-report'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { RecurringExpenseRepository } from '../../repositories/operations-report/recurring-expenses'
import { AuditService } from '../audit'
import { assertBuildingScope } from '../../utils/scope'

const FREQUENCY_MONTHS: Record<RecurringExpenseFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  yearly: 12,
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

function addMonths(date: Date, months: number, anchorDay: number): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + months, anchorDay)
}

export function computeNextReminderAt(
  frequency: RecurringExpenseFrequency,
  anchorDay: number,
  from = new Date(),
): string {
  const base = utcDate(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  let candidate = utcDate(base.getUTCFullYear(), base.getUTCMonth(), anchorDay)
  const step = FREQUENCY_MONTHS[frequency]
  while (candidate < base) candidate = addMonths(candidate, step, anchorDay)
  return dateOnly(candidate)
}

export function advanceReminderAt(
  currentReminderAt: string,
  frequency: RecurringExpenseFrequency,
  anchorDay: number,
): string {
  const [year, month, day] = currentReminderAt.split('-').map(Number)
  const current = utcDate(year!, month! - 1, day!)
  return dateOnly(addMonths(current, FREQUENCY_MONTHS[frequency], anchorDay))
}

function reminderPeriod(reminderAt: string): { periodYear: number, periodMonth: number } {
  const [year, month] = reminderAt.split('-').map(Number)
  return { periodYear: year!, periodMonth: month! }
}

function upcomingThroughDate(from = new Date()): string {
  const base = utcDate(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  base.setUTCDate(base.getUTCDate() + 7)
  return dateOnly(base)
}

async function requireBuilding(event: H3Event, buildingId: string) {
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

export const RecurringExpenseService = {
  async list(
    event: H3Event,
    user: AuthUser,
    query: RecurringExpenseListQuery,
  ): Promise<RecurringExpense[]> {
    if (!can(user, 'recurring-expenses.read')) throwForbidden('Không có quyền xem nhắc chi phí')
    await requireBuilding(event, query.building_id)
    await assertBuildingScope(event, user, query.building_id, 'read')
    return RecurringExpenseRepository.listByBuilding(event, query.building_id)
  },

  async listUpcoming(
    event: H3Event,
    user: AuthUser,
    query: RecurringExpenseListQuery,
  ): Promise<RecurringExpense[]> {
    if (!can(user, 'recurring-expenses.read')) throwForbidden('Không có quyền xem nhắc chi phí')
    await requireBuilding(event, query.building_id)
    await assertBuildingScope(event, user, query.building_id, 'read')
    return RecurringExpenseRepository.listUpcoming(event, query.building_id, upcomingThroughDate())
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: RecurringExpenseCreateInput,
  ): Promise<RecurringExpense> {
    if (!can(user, 'recurring-expenses.write')) throwForbidden('Không có quyền cấu hình nhắc chi phí')
    await requireBuilding(event, input.building_id)
    await assertBuildingScope(event, user, input.building_id, 'write')

    const created = await RecurringExpenseRepository.insert(
      event,
      {
        ...input,
        next_reminder_at: computeNextReminderAt(input.frequency, input.anchor_day),
      },
      user.id,
    )

    await AuditService.append(event, user, {
      building_id: created.buildingId,
      action: AUDIT_ACTIONS.RECURRING_EXPENSE_CREATED,
      entity_type: 'recurring_expense',
      entity_id: created.id,
      after_data: created,
    })

    return created
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: RecurringExpenseUpdateInput,
  ): Promise<RecurringExpense> {
    if (!can(user, 'recurring-expenses.write')) throwForbidden('Không có quyền cấu hình nhắc chi phí')
    const existing = await RecurringExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy nhắc chi phí')
    await assertBuildingScope(event, user, existing.buildingId, 'write')

    const frequency = input.frequency ?? existing.frequency
    const anchorDay = input.anchor_day ?? existing.anchorDay
    const shouldRecomputeReminder = input.frequency !== undefined || input.anchor_day !== undefined
    const updated = await RecurringExpenseRepository.updateById(event, id, {
      ...input,
      ...(shouldRecomputeReminder && {
        next_reminder_at: computeNextReminderAt(frequency, anchorDay),
      }),
    })

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.RECURRING_EXPENSE_UPDATED,
      entity_type: 'recurring_expense',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return updated
  },

  async delete(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'recurring-expenses.delete')) throwForbidden('Không có quyền xóa nhắc chi phí')
    const existing = await RecurringExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy nhắc chi phí')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    await RecurringExpenseRepository.deleteById(event, id)
    await AuditService.append(event, user, {
      building_id: existing.buildingId,
      action: AUDIT_ACTIONS.RECURRING_EXPENSE_DELETED,
      entity_type: 'recurring_expense',
      entity_id: existing.id,
      before_data: existing,
    })
  },

  async record(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: RecurringExpenseActionInput,
  ): Promise<{ recurringExpense: RecurringExpense, prefill: RecurringExpenseRecordPrefill }> {
    if (!can(user, 'recurring-expenses.read')) throwForbidden('Không có quyền xem nhắc chi phí')
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền ghi nhận chi phí')
    const existing = await RecurringExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy nhắc chi phí')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (!existing.isActive) throwConflict('Nhắc chi phí đã tắt')

    const period = reminderPeriod(existing.nextReminderAt)
    const nextReminderAt = advanceReminderAt(
      existing.nextReminderAt,
      existing.frequency,
      existing.anchorDay,
    )
    const updated = await RecurringExpenseRepository.updateById(event, id, {
      next_reminder_at: nextReminderAt,
    })
    const prefill: RecurringExpenseRecordPrefill = {
      buildingId: existing.buildingId,
      periodYear: input.period_year ?? period.periodYear,
      periodMonth: input.period_month ?? period.periodMonth,
      expenseDate: existing.nextReminderAt,
      category: existing.category,
      amount: existing.estimatedAmount,
      note: existing.name,
    }

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.RECURRING_EXPENSE_RECORDED,
      entity_type: 'recurring_expense',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
      metadata: { prefill },
    })

    return { recurringExpense: updated, prefill }
  },

  async dismiss(event: H3Event, user: AuthUser, id: string): Promise<RecurringExpense> {
    if (!can(user, 'recurring-expenses.read')) throwForbidden('Không có quyền xem nhắc chi phí')
    const existing = await RecurringExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy nhắc chi phí')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (!existing.isActive) throwConflict('Nhắc chi phí đã tắt')

    const updated = await RecurringExpenseRepository.updateById(event, id, {
      next_reminder_at: advanceReminderAt(
        existing.nextReminderAt,
        existing.frequency,
        existing.anchorDay,
      ),
    })

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.RECURRING_EXPENSE_DISMISSED,
      entity_type: 'recurring_expense',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return updated
  },
}
