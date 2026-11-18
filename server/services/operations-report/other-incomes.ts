import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingOtherIncome } from '~/types/operations-report'
import {
  otherIncomeDateInPeriod,
  type BuildingOtherIncomeCreateInput,
  type BuildingOtherIncomeUpdateInput,
  type BuildingOtherIncomeVoidInput,
  type OperationsReportQuery,
} from '~/utils/validators/operations-report'
import { BuildingOtherIncomeRepository } from '../../repositories/operations-report/other-incomes'
import { BuildingRepository } from '../../repositories/buildings'
import { assertBuildingScope } from '../../utils/scope'
import { invalidateOperationsReport } from './cache'

function requireReserveManager(user: AuthUser) {
  requireCapability(user, 'reserve-fund.manage', 'Cần quyền quản lý quỹ dự phòng để thay đổi khoản thu phân bổ vào quỹ')
}

async function requireBuilding(event: H3Event, user: AuthUser, buildingId: string, mode: 'read' | 'write') {
  await assertBuildingScope(event, user, buildingId, mode)
  if (!await BuildingRepository.findById(event, buildingId)) throwNotFound('Không tìm thấy tòa nhà')
}

async function requireEditableIncome(event: H3Event, user: AuthUser, id: string) {
  const income = await BuildingOtherIncomeRepository.findById(event, id)
  if (!income) throwNotFound('Không tìm thấy khoản thu')
  await assertBuildingScope(event, user, income.buildingId, 'write')
  if (income.allocationTarget === 'reserve_fund') requireReserveManager(user)
  return income
}

// The RPC serializes with close/reopen and rechecks scope, both allocations and
// row version inside the same transaction as the ledger and audit writes.
async function persist(event: H3Event, args: Parameters<typeof BuildingOtherIncomeRepository.mutate>[1]) {
  const income = await BuildingOtherIncomeRepository.mutate(event, args)
  invalidateOperationsReport(income.buildingId)
  return income
}

export const BuildingOtherIncomeService = {
  async list(event: H3Event, user: AuthUser, query: OperationsReportQuery): Promise<BuildingOtherIncome[]> {
    requireCapability(user, 'building-other-incomes.read', 'Không có quyền xem khoản thu')
    await requireBuilding(event, user, query.building_id, 'read')
    return BuildingOtherIncomeRepository.list(event, query)
  },

  async create(event: H3Event, user: AuthUser, input: BuildingOtherIncomeCreateInput): Promise<BuildingOtherIncome> {
    requireCapability(user, 'building-other-incomes.write', 'Không có quyền thêm khoản thu')
    if ((input.allocation_target ?? 'reserve_fund') === 'reserve_fund') requireReserveManager(user)
    await requireBuilding(event, user, input.building_id, 'write')
    return persist(event, { p_action: 'create', p_actor_id: user.id, p_income_id: null, p_payload: input })
  },

  async update(event: H3Event, user: AuthUser, id: string, input: BuildingOtherIncomeUpdateInput): Promise<BuildingOtherIncome> {
    requireCapability(user, 'building-other-incomes.write', 'Không có quyền sửa khoản thu')
    const income = await requireEditableIncome(event, user, id)
    if (input.allocation_target === 'reserve_fund') requireReserveManager(user)
    if (input.received_date && !otherIncomeDateInPeriod(input.received_date, income.periodYear, income.periodMonth)) {
      throwValidationError('Ngày thu phải thuộc tháng báo cáo')
    }
    return persist(event, { p_action: 'update', p_actor_id: user.id, p_income_id: id, p_payload: input })
  },

  async void(event: H3Event, user: AuthUser, id: string, input: BuildingOtherIncomeVoidInput): Promise<BuildingOtherIncome> {
    requireCapability(user, 'building-other-incomes.delete', 'Không có quyền hủy khoản thu')
    await requireEditableIncome(event, user, id)
    return persist(event, { p_action: 'void', p_actor_id: user.id, p_income_id: id, p_payload: input })
  },
}
