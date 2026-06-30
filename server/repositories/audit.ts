import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuditEvent } from '~/types/audit'
import type { AuditEntityType } from '~/utils/constants/audit'
import { mapAuditEvent } from '~/utils/mappers/audit'

export interface AuditAppendInput {
  building_id: string | null
  actor_id: string | null
  action: string
  entity_type: AuditEntityType
  entity_id?: string | null
  correlation_id?: string | null
  before_data?: unknown
  after_data?: unknown
  metadata?: Record<string, unknown>
}

export const AuditRepository = {
  async append(event: H3Event, input: AuditAppendInput): Promise<AuditEvent> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('audit_events')
      .insert({
        building_id: input.building_id,
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
    return mapAuditEvent(data)
  },

  async listByEntity(
    event: H3Event,
    entityType: AuditEntityType,
    entityId: string,
    opts?: { limit?: number },
  ): Promise<AuditEvent[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('audit_events')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapAuditEvent)
  },

  async listByBuilding(
    event: H3Event,
    buildingId: string,
    opts?: {
      limit?: number
      entityType?: AuditEntityType
      entityId?: string
      correlationId?: string
    },
  ): Promise<{ items: AuditEvent[]; total: number }> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('audit_events')
      .select('*', { count: 'exact' })
      .eq('building_id', buildingId)
    if (opts?.entityType) query = query.eq('entity_type', opts.entityType)
    if (opts?.entityId) query = query.eq('entity_id', opts.entityId)
    if (opts?.correlationId) query = query.eq('correlation_id', opts.correlationId)
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { items: (data ?? []).map(mapAuditEvent), total: count ?? 0 }
  },

  async listAll(
    event: H3Event,
    opts?: {
      limit?: number
      entityType?: AuditEntityType
      entityId?: string
      correlationId?: string
    },
  ): Promise<{ items: AuditEvent[]; total: number }> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('audit_events')
      .select('*', { count: 'exact' })
    if (opts?.entityType) query = query.eq('entity_type', opts.entityType)
    if (opts?.entityId) query = query.eq('entity_id', opts.entityId)
    if (opts?.correlationId) query = query.eq('correlation_id', opts.correlationId)
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { items: (data ?? []).map(mapAuditEvent), total: count ?? 0 }
  },
}
