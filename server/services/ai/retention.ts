import type { H3Event } from 'h3'
import { AiConversationRepository } from '../../repositories/ai/conversations'
import { AiRateLimitRepository } from '../../repositories/ai/rate-limits'
import { emitAiTelemetry } from '../../utils/ai-telemetry'

export const AiRetentionService = {
  async cleanup(event: H3Event, batchSize: number) {
    const requestId = getRequestHeader(event, 'x-request-id') ?? crypto.randomUUID()
    const startedAt = Date.now()
    const [conversationsDeleted, rateBucketsDeleted] = await Promise.all([
      AiConversationRepository.cleanupExpired(event, batchSize),
      AiRateLimitRepository.cleanup(event, Math.min(batchSize * 10, 50_000)),
    ])
    emitAiTelemetry(event, {
      event: 'ai.cleanup', requestId, outcome: 'succeeded', durationMs: Date.now() - startedAt,
    })
    return { conversationsDeleted, rateBucketsDeleted }
  },
}
