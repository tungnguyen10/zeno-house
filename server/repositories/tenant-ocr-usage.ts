import type { H3Event } from 'h3'
import { db } from '../utils/db'

export interface TenantOcrLimits {
  globalLimit: number
  userLimit: number
  budgetMicroUsd: number
  reserveMicroUsd: number
}

export type TenantOcrQuotaReason = 'global' | 'user' | 'budget'

export type TenantOcrReservation =
  | { kind: 'reserved', id: string }
  | { kind: 'quota', reason: TenantOcrQuotaReason }

export interface TenantOcrSettlement {
  costMicroUsd: number
  inputTokens: number
  outputTokens: number
  model: string
}

interface OcrRpcResult { data: unknown, error: { message?: string } | null }
type OcrRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<OcrRpcResult>

const QUOTA_ERRORS: Record<string, TenantOcrQuotaReason> = {
  TENANT_OCR_GLOBAL_LIMIT: 'global',
  TENANT_OCR_USER_LIMIT: 'user',
  TENANT_OCR_BUDGET: 'budget',
}

// Functions are not in the generated types until the cloud rollout is regenerated.
function rpcClient(event: H3Event): OcrRpc {
  const client = db(event)
  return client.rpc.bind(client) as unknown as OcrRpc
}

export const TenantOcrUsageRepository = {
  async reserve(event: H3Event, userId: string, limits: TenantOcrLimits): Promise<TenantOcrReservation> {
    const { data, error } = await rpcClient(event)('reserve_tenant_ocr', {
      p_user_id: userId,
      p_global_limit: limits.globalLimit,
      p_user_limit: limits.userLimit,
      p_budget_micro_usd: limits.budgetMicroUsd,
      p_reserve_micro_usd: limits.reserveMicroUsd,
    })
    if (error) {
      const reason = QUOTA_ERRORS[error.message ?? '']
      if (reason) return { kind: 'quota', reason }
      throwDbError(error, 'tenantOcrUsage.reserve')
    }
    return { kind: 'reserved', id: String(data) }
  },

  async settle(event: H3Event, id: string, usage: TenantOcrSettlement): Promise<void> {
    const { error } = await rpcClient(event)('settle_tenant_ocr', {
      p_id: id,
      p_cost_micro_usd: usage.costMicroUsd,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_model: usage.model,
    })
    if (error) throwDbError(error, 'tenantOcrUsage.settle')
  },

  async release(event: H3Event, id: string): Promise<void> {
    const { error } = await rpcClient(event)('release_tenant_ocr', { p_id: id })
    if (error) throwDbError(error, 'tenantOcrUsage.release')
  },
}
