import { aiUtilityUsageOverridePayloadSchema } from '~/utils/validators/ai'
import { throwAgentError } from '../../utils/ai'
import { BillingUtilityUsageService } from '../billing/utility-usages'
import type { AiActionExecutor } from './executors'

export const SAVE_UTILITY_USAGE_OVERRIDE_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.write',
  async execute({ event, user, plan, idempotencyKey }) {
    const parsed = aiUtilityUsageOverridePayloadSchema.safeParse(plan.normalizedPayload)
    if (!parsed.success) {
      throwAgentError(422, 'VALIDATION_ERROR', 'Dữ liệu điều chỉnh tiêu thụ không hợp lệ.', {
        category: 'TOOL_VALIDATION', retryable: false, details: parsed.error.flatten(),
      })
    }
    return BillingUtilityUsageService.saveOverride(
      event, user, parsed.data.billing_period_id, parsed.data.override,
      { source: 'ai', actionPlanId: plan.id, idempotencyKey },
    )
  },
}
