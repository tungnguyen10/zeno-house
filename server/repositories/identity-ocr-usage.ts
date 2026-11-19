import type { H3Event } from 'h3'
import { db } from '../utils/db'

export interface IdentityOcrLimits {
  globalLimit: number
  userLimit: number
  budgetMicroUsd: number
  reserveMicroUsd: number
}

export type IdentityOcrQuotaReason = 'global' | 'user' | 'budget'

export type IdentityOcrReservation =
  | { kind: 'reserved', id: string }
  | { kind: 'quota', reason: IdentityOcrQuotaReason }

export interface IdentityOcrSettlement {
  costMicroUsd: number
  inputTokens: number
  outputTokens: number
  model: string
}

const QUOTA_ERRORS: Record<string, IdentityOcrQuotaReason> = {
  IDENTITY_OCR_GLOBAL_LIMIT: 'global',
  IDENTITY_OCR_USER_LIMIT: 'user',
  IDENTITY_OCR_BUDGET: 'budget',
}

export const IdentityOcrUsageRepository = {
  async reserve(event: H3Event, userId: string, limits: IdentityOcrLimits): Promise<IdentityOcrReservation> {
    const { data, error } = await db(event).rpc('reserve_identity_ocr', {
      p_user_id: userId,
      p_global_limit: limits.globalLimit,
      p_user_limit: limits.userLimit,
      p_budget_micro_usd: limits.budgetMicroUsd,
      p_reserve_micro_usd: limits.reserveMicroUsd,
    })
    if (error) {
      const reason = QUOTA_ERRORS[error.message ?? '']
      if (reason) return { kind: 'quota', reason }
      throwDbError(error, 'identityOcrUsage.reserve')
    }
    return { kind: 'reserved', id: String(data) }
  },

  async settle(event: H3Event, id: string, usage: IdentityOcrSettlement): Promise<void> {
    const { error } = await db(event).rpc('settle_identity_ocr', {
      p_id: id,
      p_cost_micro_usd: usage.costMicroUsd,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_model: usage.model,
    })
    if (error) throwDbError(error, 'identityOcrUsage.settle')
  },

  async release(event: H3Event, id: string): Promise<void> {
    const { error } = await db(event).rpc('release_identity_ocr', { p_id: id })
    if (error) throwDbError(error, 'identityOcrUsage.release')
  },
}
