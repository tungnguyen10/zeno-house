import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingAuditEvent } from '~/types/billing'
import type { BillingAuditEntityType } from '~/utils/constants/billing'
import { BillingAuditRepository } from '../../repositories/billing/audit'

/**
 * Append a billing audit event. Callers (the other billing services) should
 * use this helper rather than calling the repository directly so the actor id
 * is consistently sourced from the authenticated user.
 */
export const BillingAuditService = {
  async append(
    event: H3Event,
    user: AuthUser,
    input: {
      billing_period_id: string | null
      action: string
      entity_type: BillingAuditEntityType
      entity_id?: string | null
      before_data?: unknown
      after_data?: unknown
      metadata?: Record<string, unknown>
    },
  ): Promise<BillingAuditEvent> {
    return BillingAuditRepository.append(event, {
      billing_period_id: input.billing_period_id,
      actor_id: user.id ?? null,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      before_data: input.before_data,
      after_data: input.after_data,
      metadata: input.metadata,
    })
  },

  async listByPeriod(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
  ): Promise<BillingAuditEvent[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem nhật ký vận hành')
    return BillingAuditRepository.listByPeriod(event, billingPeriodId)
  },
}
