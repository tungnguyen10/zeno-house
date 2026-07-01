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
  correlation_id?: string | null
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
        correlation_id: input.correlation_id ?? null,
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

  /**
   * List events for a period with index-safe DB-level filters applied
   * (actor, action, created_at range, correlation). Free-text search (`q`) and
   * cursor/limit pagination are applied by the service after enrichment, since
   * they target resolved fields (tenant name, invoice code, summary).
   */
  async listByPeriodFiltered(
    event: H3Event,
    billingPeriodId: string,
    filters: {
      actorIds?: string[]
      actions?: string[]
      from?: string
      to?: string
      correlationId?: string
      max?: number
    },
  ): Promise<BillingAuditEvent[]> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('billing_audit_events')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
    if (filters.actorIds && filters.actorIds.length > 0) {
      query = query.in('actor_id', filters.actorIds)
    }
    if (filters.actions && filters.actions.length > 0) {
      query = query.in('action', filters.actions)
    }
    if (filters.from) query = query.gte('created_at', filters.from)
    if (filters.to) query = query.lte('created_at', filters.to)
    if (filters.correlationId) query = query.eq('correlation_id', filters.correlationId)
    query = query.order('created_at', { ascending: false }).limit(filters.max ?? 1000)
    const { data, error } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingAuditEvent)
  },

  /**
   * Return the correlation_id of the most recent event for a given entity and
   * action, or null. Used to let a follow-up operation (e.g. reissue) inherit
   * the correlation of a prior one (e.g. void) so the audit drawer groups them.
   */
  async findLatestCorrelation(
    event: H3Event,
    entityId: string,
    action: string,
  ): Promise<string | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_audit_events')
      .select('correlation_id')
      .eq('entity_id', entityId)
      .eq('action', action)
      .not('correlation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data?.correlation_id ?? null
  },
}
