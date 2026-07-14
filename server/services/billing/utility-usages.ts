import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingPeriod, BillingUtilityUsage } from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingUtilityUsageRepository } from '../../repositories/billing/utility-usages'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { RoomRepository } from '../../repositories/rooms'
import { assertReason } from '../../utils/billing/reason'
import { assertBuildingScope } from '../../utils/scope'
import { BillingAuditService } from './audit'

interface UtilityUsageOperationContext {
  source: 'api' | 'ai'
  actionPlanId?: string
  idempotencyKey?: string
}

async function assertUtilityUsageEditable(
  event: H3Event,
  period: BillingPeriod,
  roomId: string,
): Promise<void> {
  if (period.status === 'closed') throwConflict('Kỳ đã chốt, không thể điều chỉnh')
  const room = await RoomRepository.findById(event, roomId)
  if (!room || room.buildingId !== period.buildingId) throwValidationError('Phòng không thuộc kỳ vận hành')
  const invoices = await InvoiceRepository.listByPeriod(event, period.id)
  if (invoices.some(invoice => invoice.roomId === roomId && invoice.status !== 'void')) {
    throwConflict('Phòng đã có hóa đơn đang hiệu lực, không thể điều chỉnh')
  }
}

export const BillingUtilityUsageService = {
  async list(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
  ): Promise<BillingUtilityUsage[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem điều chỉnh tiêu thụ')
    const period = await BillingPeriodRepository.findById(event, billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')
    return BillingUtilityUsageRepository.listByPeriod(event, billingPeriodId)
  },

  /**
   * Save (insert or update) a utility usage override for a room+meter in the
   * given period. Used for meter replacement, reset, correction, or manual
   * adjustment cases. Blocked when the period is closed.
   */
  async saveOverride(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
    input: UtilityUsageOverrideInput,
    operation: UtilityUsageOperationContext = { source: 'api' },
  ): Promise<BillingUtilityUsage> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền điều chỉnh tiêu thụ')

    if (input.reason !== 'normal') {
      assertReason(input.note ?? '', 10)
    }

    const period = await BillingPeriodRepository.findById(event, billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    await assertUtilityUsageEditable(event, period, input.room_id)

    const before = await BillingUtilityUsageRepository.findByPeriodRoomMeter(
      event,
      billingPeriodId,
      input.room_id,
      input.meter_type,
    )
    const expectedUpdatedAt = input.expected_updated_at === undefined
      ? before?.updatedAt ?? null
      : input.expected_updated_at
    const saved = await BillingUtilityUsageRepository.saveWithAudit(
      event,
      billingPeriodId,
      user.id,
      { ...input, expected_updated_at: expectedUpdatedAt },
      {
        source: operation.source,
        action_plan_id: operation.actionPlanId,
        idempotency_key: operation.idempotencyKey,
      },
    )

    return saved
  },

  async deleteOverride(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
    overrideId: string,
  ): Promise<void> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền xóa điều chỉnh tiêu thụ')

    const period = await BillingPeriodRepository.findById(event, billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    const row = await BillingUtilityUsageRepository.findById(event, billingPeriodId, overrideId)
    if (!row) throwNotFound('Không tìm thấy điều chỉnh tiêu thụ')
    await assertUtilityUsageEditable(event, period, row.roomId)

    await BillingUtilityUsageRepository.deleteById(event, overrideId)

    await BillingAuditService.append(event, user, {
      billing_period_id: billingPeriodId,
      action: BILLING_AUDIT_ACTIONS.UTILITY_OVERRIDE_DELETED,
      entity_type: 'billing_utility_usage',
      entity_id: overrideId,
      before_data: row,
      after_data: null,
      metadata: {
        room_id: row.roomId,
        meter_type: row.meterType,
        reason: row.reason,
      },
    })
  },

  async approveOverride(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
    overrideId: string,
  ): Promise<BillingUtilityUsage> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền duyệt điều chỉnh tiêu thụ')

    const period = await BillingPeriodRepository.findById(event, billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')

    const before = await BillingUtilityUsageRepository.findById(event, billingPeriodId, overrideId)
    if (!before) throwNotFound('Không tìm thấy điều chỉnh tiêu thụ')
    await assertUtilityUsageEditable(event, period, before.roomId)
    if (before.approvedBy) throwConflict('Điều chỉnh này đã được duyệt rồi')

    const approved = await BillingUtilityUsageRepository.approveById(
      event,
      overrideId,
      user.id ?? null,
    )

    await BillingAuditService.append(event, user, {
      billing_period_id: billingPeriodId,
      action: BILLING_AUDIT_ACTIONS.UTILITY_OVERRIDE_APPROVED,
      entity_type: 'billing_utility_usage',
      entity_id: overrideId,
      before_data: before,
      after_data: approved,
      metadata: {
        room_id: approved.roomId,
        meter_type: approved.meterType,
      },
    })

    return approved
  },
}
