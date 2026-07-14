import type { H3Event } from 'h3'
import type { AiActionPlanDto, AiBuildingSummary } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import type { Room } from '~/types/rooms'
import { isUuid } from '~/utils/format/slug'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type { AiToolPlanUtilityUsageOverrideInput } from '~/utils/validators/ai'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingUtilityUsageRepository } from '../../repositories/billing/utility-usages'
import { RoomRepository } from '../../repositories/rooms'
import { can } from '../../utils/permissions'
import { AiActionService } from './actions'
import { AiBuildingService } from './buildings'

export type AiUtilityOverridePlanResult =
  | { status: 'planned'; actionPlan: AiActionPlanDto }
  | { status: 'needs_building_clarification'; candidates: AiBuildingSummary[] }
  | { status: 'needs_room_clarification'; candidates: Array<{ id: string; code: string; roomNumber: string }> }
  | { status: 'not_found' }

function exactRooms(rooms: Room[], reference: string): Room[] {
  const normalized = reference.trim().toLocaleLowerCase('vi-VN')
  return rooms.filter(room =>
    (isUuid(reference) && room.id === reference)
    || [room.code, room.slug, room.roomNumber].some(value => value.toLocaleLowerCase('vi-VN') === normalized))
}

export const AiUtilityOverridePlanner = {
  async plan(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanUtilityUsageOverrideInput,
  ): Promise<AiUtilityOverridePlanResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền điều chỉnh tiêu thụ')
    const buildingResolution = await AiBuildingService.resolve(event, user, input.building_ref)
    if (buildingResolution.status === 'not_found') return buildingResolution
    if (buildingResolution.status === 'ambiguous') {
      return { status: 'needs_building_clarification', candidates: buildingResolution.candidates }
    }
    const building = buildingResolution.building
    const period = await BillingPeriodRepository.findByBuildingPeriod(
      event, building.id, input.period_year, input.period_month,
    )
    if (!period) return { status: 'not_found' }
    if (period.status === 'closed') throwConflict('Kỳ đã chốt, không thể điều chỉnh')

    const rooms = await RoomRepository.listByBuilding(event, building.id)
    const matches = exactRooms(rooms, input.room_ref)
    if (matches.length === 0) return { status: 'not_found' }
    if (matches.length > 1) {
      return { status: 'needs_room_clarification', candidates: matches.map(room => ({
        id: room.id, code: room.code, roomNumber: room.roomNumber,
      })) }
    }
    const room = matches[0]!
    const invoices = await InvoiceRepository.listByPeriod(event, period.id)
    if (invoices.some(invoice => invoice.roomId === room.id && invoice.status !== 'void')) {
      throwConflict('Phòng đã có hóa đơn đang hiệu lực, không thể điều chỉnh')
    }
    const existing = await BillingUtilityUsageRepository.findByPeriodRoomMeter(
      event, period.id, room.id, input.meter_type,
    )
    const normalizedOverride = {
      room_id: room.id,
      meter_type: input.meter_type,
      previous_reading_id: input.previous_reading_id ?? null,
      previous_reading_value: input.previous_reading_value,
      current_reading_id: input.current_reading_id ?? null,
      current_reading_value: input.current_reading_value,
      old_meter_final_value: input.old_meter_final_value ?? null,
      new_meter_start_value: input.new_meter_start_value ?? null,
      billable_usage: input.billable_usage,
      reason: input.reason,
      note: input.note ?? null,
      expected_updated_at: existing?.updatedAt ?? null,
    }
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: building.id,
      action_type: 'save_utility_usage_override',
      title: `Điều chỉnh ${input.meter_type === 'electricity' ? 'điện' : 'nước'} phòng ${room.roomNumber}`,
      summary: `Ghi mức tiêu thụ tính tiền ${input.billable_usage} cho phòng ${room.roomNumber}.`,
      normalized_payload: { billing_period_id: period.id, override: normalizedOverride },
      preview: {
        building: { id: building.id, name: building.name },
        period: { id: period.id, year: period.periodYear, month: period.periodMonth },
        room: { id: room.id, number: room.roomNumber },
        meter_type: input.meter_type,
        before: existing,
        after: normalizedOverride,
      },
      warnings: input.reason === 'normal' ? [] : [`Lý do: ${input.reason}`],
      resource_versions: {
        [`period:${period.id}`]: period.updatedAt,
        [`utility_override:${period.id}:${room.id}:${input.meter_type}`]: existing?.updatedAt ?? 'absent',
      },
      expires_in_seconds: 900,
    })
    return { status: 'planned', actionPlan: toAiActionPlanDto(plan) }
  },
}
