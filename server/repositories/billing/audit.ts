import { db as serverSupabaseClient } from '../../utils/db'
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

export function decodeBillingAuditCursor(cursor?: string): { createdAt: string | null; id: string | null } {
  if (!cursor) return { createdAt: null, id: null }
  const separator = cursor.lastIndexOf('|')
  if (separator === -1) return { createdAt: cursor, id: null }
  return {
    createdAt: cursor.slice(0, separator),
    id: cursor.slice(separator + 1) || null,
  }
}

export function encodeBillingAuditCursor(row: BillingAuditEvent): string {
  return `${row.createdAt}|${row.id}`
}

export const BillingAuditRepository = {
  async appendMany(event: H3Event, inputs: AuditAppendInput[]): Promise<BillingAuditEvent[]> {
    if (inputs.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_audit_events')
      .insert(inputs.map(input => ({
        billing_period_id: input.billing_period_id,
        actor_id: input.actor_id,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        correlation_id: input.correlation_id ?? null,
        before_data: (input.before_data ?? null) as never,
        after_data: (input.after_data ?? null) as never,
        metadata: (input.metadata ?? {}) as never,
      })))
      .select()
    if (error) throwDbError(error, 'billing.audit.appendMany')
    return (data ?? []).map(mapBillingAuditEvent)
  },
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
    if (error) throwDbError(error, 'billing.audit.append')
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
    if (error) throwDbError(error, 'billing.audit.listByPeriod')
    return (data ?? []).map(mapBillingAuditEvent)
  },

  /** Apply every filter plus stable `(created_at, id)` cursor pagination in SQL. */
  async listByPeriodFiltered(
    event: H3Event,
    billingPeriodId: string,
    filters: {
      actorIds?: string[]
      actions?: string[]
      from?: string
      to?: string
      correlationId?: string
      cursor?: string
      limit?: number
      q?: string
    },
  ): Promise<BillingAuditEvent[]> {
    const limit = Math.min(filters.limit ?? 100, 100)
    const cursor = decodeBillingAuditCursor(filters.cursor)
    const client = serverSupabaseClient(event)
    const { data, error } = await client.rpc('billing_audit_search_page' as never, {
      p_period_id: billingPeriodId,
      p_actor_ids: filters.actorIds ?? null,
      p_actions: filters.actions ?? null,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_correlation_id: filters.correlationId ?? null,
      p_cursor: cursor.createdAt,
      p_cursor_id: cursor.id,
      p_query: filters.q ?? null,
      p_limit: limit,
    } as never)
    if (error) throwDbError(error, 'billing.audit.searchPage')
    return ((data ?? []) as unknown as Parameters<typeof mapBillingAuditEvent>[0][]).map(mapBillingAuditEvent)
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
    if (error) throwDbError(error, 'billing.audit.findLatestCorrelation')
    return data?.correlation_id ?? null
  },

  /**
   * Check whether a period already has at least one event of a given action.
   * Used by guard rules that depend on historical workflow steps.
   */
  async hasActionForPeriod(
    event: H3Event,
    billingPeriodId: string,
    action: string,
  ): Promise<boolean> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_audit_events')
      .select('id')
      .eq('billing_period_id', billingPeriodId)
      .eq('action', action)
      .limit(1)
      .maybeSingle()
    if (error) throwDbError(error, 'billing.audit.hasActionForPeriod')
    return !!data
  },
}
