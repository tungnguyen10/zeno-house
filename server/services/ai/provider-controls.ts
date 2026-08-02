import type { H3Event } from 'h3'
import { AiProviderControlRepository } from '../../repositories/ai/provider-controls'
import { emitAiTelemetry } from '../../utils/ai-telemetry'

export const AiProviderControlService = {
  async acquire(event: H3Event, input: {
    provider: string
    dailyLimit: number
    failureThreshold: number
    cooldownMs: number
    requestId?: string
  }): Promise<void> {
    const result = await AiProviderControlRepository.acquire(event, input)
    if (result.allowed) return
    setResponseHeader(event, 'Retry-After', result.retryAfterSeconds)
    const circuitOpen = result.reason === 'circuit_open'
    emitAiTelemetry(event, {
      event: 'ai.circuit', requestId: input.requestId ?? 'unavailable', provider: input.provider,
      outcome: 'rejected', errorCategory: circuitOpen ? 'CIRCUIT_OPEN' : 'PROVIDER_CAPACITY',
    })
    throw createError({
      statusCode: 503,
      data: {
        error: {
          code: circuitOpen ? 'PROVIDER_CIRCUIT_OPEN' : 'PROVIDER_CAPACITY',
          message: circuitOpen
            ? 'Nhà cung cấp AI đang tạm nghỉ. Vui lòng thử lại sau.'
            : 'AI đang hết dung lượng miễn phí. Vui lòng thử lại sau.',
          details: {
            category: circuitOpen ? 'CIRCUIT_OPEN' : 'PROVIDER_CAPACITY',
            retryable: true,
            retryAfterSeconds: result.retryAfterSeconds,
          },
        },
      },
    })
  },

  async record(event: H3Event, input: {
    provider: string
    succeeded: boolean
    failureThreshold: number
  }): Promise<void> {
    await AiProviderControlRepository.record(event, input)
  },
}
