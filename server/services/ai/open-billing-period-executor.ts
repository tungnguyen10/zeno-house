import { aiOpenBillingPeriodPayloadSchema } from '~/utils/validators/ai'
import { BuildingRepository } from '../../repositories/buildings'
import { throwAgentError } from '../../utils/ai'
import { BillingPeriodService } from '../billing/periods'
import type { AiActionExecutor } from './executors'

function parsePayload(payload: Record<string, unknown>) {
  const parsed = aiOpenBillingPeriodPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throwAgentError(422, 'VALIDATION_ERROR', 'Dữ liệu mở kỳ không hợp lệ.', {
      category: 'TOOL_VALIDATION', retryable: false, details: parsed.error.flatten(),
    })
  }
  return parsed.data
}

export const OPEN_BILLING_PERIOD_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.write',

  async revalidate({ event, plan }) {
    const payload = parsePayload(plan.normalizedPayload)
    const building = await BuildingRepository.findById(event, payload.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    if (plan.resourceVersions.building !== building.updatedAt) {
      throwAgentError(409, 'CONFLICT', 'Thông tin tòa nhà đã thay đổi. Vui lòng tạo lại kế hoạch.', {
        category: 'OPTIMISTIC_LOCK_CONFLICT',
        retryable: true,
        actionPlanId: plan.id,
        conversationId: plan.conversationId,
      })
    }
  },

  async execute({ event, user, plan, idempotencyKey }) {
    const payload = parsePayload(plan.normalizedPayload)
    return BillingPeriodService.openOrGetWithResult(event, user, payload, {
      source: 'ai',
      actionPlanId: plan.id,
      idempotencyKey,
    })
  },
}
