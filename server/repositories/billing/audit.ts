import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingAuditEvent } from '~/types/billing'
import type { BillingAuditEntityType } from '~/utils/constants/billing'
import { mapBillingAuditEvent } from '~/utils/mappers/billing'

export interface AuditAppendInput {
  billing_period_id: string | null
  actor_id: string | null
  action: string
  entity_type: BillingAuditEntityType
  entity_id?: string | null
  before_data?: unknown
  after_data?: unknown
  metadata?: Record<string, unknown>
}

export const BillingAuditRepository = {
  async append(event: H3Event, input: AuditAppendInput): Promise<BillingAuditEvent> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_audit_events')
      .insert({
        billing_period_id: input.billing_period_id,
        actor_id: input.actor_id,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        before_data: (input.before_data ?? null) as never,
        after_data: (input.after_data ?? null) as never,
        metadata: (input.metadata ?? {}) as never,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingAuditEvent(data)
  },

  async listByPeriod(
    event: H3Event,
    billingPeriodId: string,
  ): Promise<BillingAuditEvent[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_audit_events')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .order('created_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingAuditEvent)
  },
}
