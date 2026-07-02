import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingFixedCost } from '~/types/operations-report'
import type {
  BuildingFixedCostCreateInput,
  BuildingFixedCostUpdateInput,
} from '~/utils/validators/operations-report'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingFixedCostRepository } from '../../repositories/operations-report/fixed-costs'
import { AuditService } from '../audit'
import { assertBuildingScope } from '../../utils/scope'

/** period ordinal used for range comparisons (year*12 + month). */
function ordinal(year: number, month: number): number {
  return year * 12 + month
}

/** True when two effective ranges (to = null means open-ended) overlap. */
function rangesOverlap(
  aFrom: number,
  aTo: number | null,
  bFrom: number,
  bTo: number | null,
): boolean {
  const aEnd = aTo ?? Number.POSITIVE_INFINITY
  const bEnd = bTo ?? Number.POSITIVE_INFINITY
  return aFrom <= bEnd && bFrom <= aEnd
}

async function requireBuilding(event: H3Event, buildingId: string) {
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

export const BuildingFixedCostService = {
  async list(event: H3Event, user: AuthUser, buildingId: string): Promise<BuildingFixedCost[]> {
    if (!can(user, 'building-fixed-costs.read')) throwForbidden('Không có quyền xem chi phí cố định')
    await requireBuilding(event, buildingId)
    await assertBuildingScope(event, user, buildingId, 'read')
    return BuildingFixedCostRepository.listByBuilding(event, buildingId)
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: BuildingFixedCostCreateInput,
  ): Promise<BuildingFixedCost> {
    if (!can(user, 'building-fixed-costs.write'))
      throwForbidden('Không có quyền cấu hình chi phí cố định')
    await requireBuilding(event, input.building_id)
    await assertBuildingScope(event, user, input.building_id, 'write')

    await this.assertNoOverlap(event, input.building_id, input.category, {
      from: ordinal(input.effective_from_period_year, input.effective_from_period_month),
      to:
        input.effective_to_period_year != null && input.effective_to_period_month != null
          ? ordinal(input.effective_to_period_year, input.effective_to_period_month)
          : null,
    })

    const created = await BuildingFixedCostRepository.insert(event, input, user.id)

    await AuditService.append(event, user, {
      building_id: created.buildingId,
      action: AUDIT_ACTIONS.BUILDING_FIXED_COST_CREATED,
      entity_type: 'building_fixed_cost',
      entity_id: created.id,
      after_data: created,
    })

    return created
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: BuildingFixedCostUpdateInput,
  ): Promise<BuildingFixedCost> {
    if (!can(user, 'building-fixed-costs.write'))
      throwForbidden('Không có quyền cấu hình chi phí cố định')
    const existing = await BuildingFixedCostRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy chi phí cố định')
    await assertBuildingScope(event, user, existing.buildingId, 'write')

    // If the effective-to changes, re-check overlap against the other rows.
    const nextTo =
      input.effective_to_period_year !== undefined || input.effective_to_period_month !== undefined
        ? input.effective_to_period_year != null && input.effective_to_period_month != null
          ? ordinal(input.effective_to_period_year, input.effective_to_period_month)
          : null
        : existing.effectiveToPeriodYear != null && existing.effectiveToPeriodMonth != null
          ? ordinal(existing.effectiveToPeriodYear, existing.effectiveToPeriodMonth)
          : null
    await this.assertNoOverlap(
      event,
      existing.buildingId,
      existing.category,
      {
        from: ordinal(existing.effectiveFromPeriodYear, existing.effectiveFromPeriodMonth),
        to: nextTo,
      },
      id,
    )

    const ended =
      input.effective_to_period_year !== undefined && existing.effectiveToPeriodYear == null
    const updated = await BuildingFixedCostRepository.updateById(event, id, input)

    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: ended
        ? AUDIT_ACTIONS.BUILDING_FIXED_COST_ENDED
        : AUDIT_ACTIONS.BUILDING_FIXED_COST_UPDATED,
      entity_type: 'building_fixed_cost',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return updated
  },

  async assertNoOverlap(
    event: H3Event,
    buildingId: string,
    category: string,
    range: { from: number, to: number | null },
    excludeId?: string,
  ): Promise<void> {
    const existing = await BuildingFixedCostRepository.listByBuilding(event, buildingId)
    for (const row of existing) {
      if (row.id === excludeId) continue
      if (row.category !== category) continue
      const rowFrom = ordinal(row.effectiveFromPeriodYear, row.effectiveFromPeriodMonth)
      const rowTo =
        row.effectiveToPeriodYear != null && row.effectiveToPeriodMonth != null
          ? ordinal(row.effectiveToPeriodYear, row.effectiveToPeriodMonth)
          : null
      if (rangesOverlap(range.from, range.to, rowFrom, rowTo)) {
        throwConflict('Khoảng hiệu lực bị trùng với một chi phí cố định đang tồn tại')
      }
    }
  },
}
