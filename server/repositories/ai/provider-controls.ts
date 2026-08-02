import type { H3Event } from 'h3'
import { db } from '../../utils/db'

export interface AiProviderAcquireResult {
  allowed: boolean
  reason: 'circuit_open' | 'daily_quota' | null
  retryAfterSeconds: number
}

type UntypedRpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

export const AiProviderControlRepository = {
  async acquire(event: H3Event, input: {
    provider: string
    dailyLimit: number
    failureThreshold: number
    cooldownMs: number
  }): Promise<AiProviderAcquireResult> {
    const client = db(event)
    const rpc = client.rpc.bind(client) as unknown as UntypedRpc
    const { data, error } = await rpc('acquire_ai_provider_request', {
      p_provider: input.provider,
      p_daily_limit: input.dailyLimit,
      p_failure_threshold: input.failureThreshold,
      p_cooldown_ms: input.cooldownMs,
    })
    if (error) throwDbError(error, 'ai.providerControls.acquire')
    const row = (Array.isArray(data) ? data[0] : null) as {
      allowed?: unknown
      reason?: unknown
      retry_after_seconds?: unknown
    } | null
    if (!row || typeof row.allowed !== 'boolean') {
      throwInternal(new Error('Empty AI provider control result'), 'ai.providerControls.acquire')
    }
    return {
      allowed: row.allowed,
      reason: row.reason === 'circuit_open' || row.reason === 'daily_quota' ? row.reason : null,
      retryAfterSeconds: Number(row.retry_after_seconds ?? 1),
    }
  },

  async record(event: H3Event, input: {
    provider: string
    succeeded: boolean
    failureThreshold: number
  }): Promise<void> {
    const client = db(event)
    const rpc = client.rpc.bind(client) as unknown as UntypedRpc
    const { error } = await rpc('record_ai_provider_outcome', {
      p_provider: input.provider,
      p_succeeded: input.succeeded,
      p_failure_threshold: input.failureThreshold,
    })
    if (error) throwDbError(error, 'ai.providerControls.record')
  },
}
