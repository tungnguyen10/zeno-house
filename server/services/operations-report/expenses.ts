import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense } from '~/types/operations-report'
import type {
  BuildingExpenseCreateInput,
  BuildingExpenseListQuery,
  BuildingExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import {
  BuildingExpenseRepository,
  type BuildingExpenseListFilter,
} from '../../repositories/operations-report/expenses'
import { AuditService } from '../audit'
import { assertBuildingScope } from '../../utils/scope'

async function requireBuilding(event: H3Event, buildingId: string) {
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

export const BuildingExpenseService = {
  async list(
    event: H3Event,
    user: AuthUser,
    query: BuildingExpenseListQuery,
  ): Promise<BuildingExpense[]> {
    if (!can(user, 'building-expenses.read')) throwForbidden('Không có quyền xem chi phí')
    await requireBuilding(event, query.building_id)
    await assertBuildingScope(event, user, query.building_id, 'read')
    const filter: BuildingExpenseListFilter = {
      buildingId: query.building_id,
      periodYear: query.period_year,
      periodMonth: query.period_month,
      category: query.category,
    }
    return BuildingExpenseRepository.list(event, filter)
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: BuildingExpenseCreateInput,
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền thêm chi phí')
    await requireBuilding(event, input.building_id)
    await assertBuildingScope(event, user, input.building_id, 'write')

    const created = await BuildingExpenseRepository.insert(event, input, user.id)

    await AuditService.append(event, user, {
      building_id: created.buildingId,
      action: AUDIT_ACTIONS.BUILDING_EXPENSE_CREATED,
      entity_type: 'building_expense',
      entity_id: created.id,
      after_data: created,
    })

    return created
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: BuildingExpenseUpdateInput,
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.write')) throwForbidden('Không có quyền sửa chi phí')
    const existing = await BuildingExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy khoản chi')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (existing.voidedAt) throwConflict('Khoản chi đã bị hủy, không thể sửa')

    const updated = await BuildingExpenseRepository.updateById(event, id, input)

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.BUILDING_EXPENSE_UPDATED,
      entity_type: 'building_expense',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return updated
  },

  async void(
    event: H3Event,
    user: AuthUser,
    id: string,
    voidReason: string,
  ): Promise<BuildingExpense> {
    if (!can(user, 'building-expenses.delete')) throwForbidden('Không có quyền hủy chi phí')
    const existing = await BuildingExpenseRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy khoản chi')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (existing.voidedAt) throwConflict('Khoản chi đã bị hủy')

    const voided = await BuildingExpenseRepository.voidById(event, id, user.id, voidReason)

    await AuditService.append(event, user, {
      building_id: voided.buildingId,
      action: AUDIT_ACTIONS.BUILDING_EXPENSE_VOIDED,
      entity_type: 'building_expense',
      entity_id: voided.id,
      before_data: existing,
      after_data: voided,
      metadata: { void_reason: voidReason },
    })

    return voided
  },
}
