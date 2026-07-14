import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AiRuntimePolicy } from '../../utils/ai-runtime'
import { emitAiTelemetry } from '../../utils/ai-telemetry'
import { AiRateLimitRepository } from '../../repositories/ai/rate-limits'

export async function enforceAiRateLimit(
  event: H3Event,
  input: {
    userId: string
    scope: 'chat' | 'action'
    requestId: string
    conversationId?: string
    policy: AiRuntimePolicy
  },
): Promise<void> {
  const limit = input.scope === 'chat' ? input.policy.chatRateLimit : input.policy.actionRateLimit
  const subjectHash = createHash('sha256').update(input.userId).digest('hex')
  const result = await AiRateLimitRepository.consume(event, {
    subjectHash,
    scope: input.scope,
    limit,
    windowSeconds: input.policy.rateWindowSeconds,
  })
  if (result.allowed) return

  setResponseHeader(event, 'Retry-After', result.retryAfterSeconds)
  emitAiTelemetry(event, {
    event: 'ai.rate_limit',
    requestId: input.requestId,
    conversationId: input.conversationId,
    outcome: 'rejected',
    errorCategory: 'RATE_LIMITED',
  })
  throw createError({
    statusCode: 429,
    data: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
        details: { category: 'RATE_LIMITED', retryable: true, retryAfterSeconds: result.retryAfterSeconds },
      },
    },
  })
}
