import type { H3Event } from 'h3'
import { db } from '../../utils/db'

export interface AiRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export const AiRateLimitRepository = {
  async consume(
    event: H3Event,
    input: { subjectHash: string; scope: 'chat' | 'action'; limit: number; windowSeconds: number },
  ): Promise<AiRateLimitResult> {
    const client = db(event)
    const { data, error } = await client.rpc('consume_ai_rate_limit', {
      p_subject_hash: input.subjectHash,
      p_scope: input.scope,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    })
    if (error) throwDbError(error, 'ai.rateLimits.consume')
    const row = ((data ?? []) as unknown as Array<{
      allowed: boolean
      remaining: number
      retry_after_seconds: number
    }>)[0]
    if (!row) throwInternal(new Error('Empty AI rate limit result'), 'ai.rateLimits.consume')
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
    }
  },

  async cleanup(event: H3Event, limit: number): Promise<number> {
    const client = db(event)
    const { data, error } = await client.rpc('cleanup_expired_ai_rate_limits', {
      p_limit: limit,
    })
    if (error) throwDbError(error, 'ai.rateLimits.cleanup')
    return Number(data ?? 0)
  },
}
