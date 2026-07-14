import { aiMeterImportPayloadSchema, aiMeterReadingUpdatePayloadSchema } from '~/utils/validators/ai'
import { throwAgentError } from '../../utils/ai'
import { MeterReadingService } from '../meter-readings'
import type { AiActionExecutor } from './executors'

function invalidPayload(message: string, details: unknown): never {
  throwAgentError(422, 'VALIDATION_ERROR', message, {
    category: 'TOOL_VALIDATION', retryable: false, details,
  })
}

export const IMPORT_METER_READINGS_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'meter-readings.write',
  async execute({ event, user, plan, idempotencyKey }) {
    const parsed = aiMeterImportPayloadSchema.safeParse(plan.normalizedPayload)
    if (!parsed.success) invalidPayload('Dữ liệu nhập chỉ số không hợp lệ.', parsed.error.flatten())
    return MeterReadingService.commitMonthlyImport(event, user, parsed.data, {
      source: 'ai', actionPlanId: plan.id, idempotencyKey,
    })
  },
}

export const UPDATE_METER_READING_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'meter-readings.write',
  async execute({ event, user, plan, idempotencyKey }) {
    const parsed = aiMeterReadingUpdatePayloadSchema.safeParse(plan.normalizedPayload)
    if (!parsed.success) invalidPayload('Dữ liệu sửa chỉ số không hợp lệ.', parsed.error.flatten())
    const { reading_id, expected_updated_at, ...changes } = parsed.data
    return MeterReadingService.update(event, user, reading_id, {
      ...changes,
      expected_updated_at,
    }, { source: 'ai', actionPlanId: plan.id, idempotencyKey })
  },
}
