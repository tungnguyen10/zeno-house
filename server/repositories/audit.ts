import { db as serverSupabaseClient } from '../utils/db'
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

interface AuditListOptions {
  limit?: number
  entityType?: AuditEntityType
  entityId?: string
  correlationId?: string
  cursor?: string
}

export function decodeAuditCursor(cursor?: string): { createdAt: string | null, id: string | null } {
  if (!cursor) return { createdAt: null, id: null }
  const separator = cursor.lastIndexOf('|')
  const createdAt = separator === -1 ? cursor : cursor.slice(0, separator)
  const id = separator === -1 ? null : cursor.slice(separator + 1) || null
  if (Number.isNaN(Date.parse(createdAt))) return { createdAt: null, id: null }
  if (id && !/^[a-z0-9-]+$/i.test(id)) return { createdAt: null, id: null }
  return { createdAt, id }
}

export function encodeAuditCursor(row: Pick<AuditEvent, 'createdAt' | 'id'>): string {
  return `${row.createdAt}|${row.id}`
}

export const AuditRepository = {
  async appendMany(event: H3Event, inputs: AuditAppendInput[]): Promise<AuditEvent[]> {
    if (inputs.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('audit_events')
      .insert(inputs.map(input => ({
        building_id: input.building_id,
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
    if (error) throwDbError(error, 'audit.appendMany')
    return (data ?? []).map(mapAuditEvent)
  },
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
    if (error) throwDbError(error, 'audit.append')
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
    if (error) throwDbError(error, 'audit.listByEntity')
    return (data ?? []).map(mapAuditEvent)
  },

  async listByBuilding(
    event: H3Event,
    buildingId: string,
    opts?: AuditListOptions,
  ): Promise<{ items: AuditEvent[], total: number, nextCursor: string | null }> {
    const client = await serverSupabaseClient(event)
    const limit = opts?.limit ?? 50
    const cursor = decodeAuditCursor(opts?.cursor)
    let countQuery = client
      .from('audit_events')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
    let query = client
      .from('audit_events')
      .select('*')
      .eq('building_id', buildingId)
    if (opts?.entityType) {
      countQuery = countQuery.eq('entity_type', opts.entityType)
      query = query.eq('entity_type', opts.entityType)
    }
    if (opts?.entityId) {
      countQuery = countQuery.eq('entity_id', opts.entityId)
      query = query.eq('entity_id', opts.entityId)
    }
    if (opts?.correlationId) {
      countQuery = countQuery.eq('correlation_id', opts.correlationId)
      query = query.eq('correlation_id', opts.correlationId)
    }
    if (cursor.createdAt) {
      query = cursor.id
        ? query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
        : query.lt('created_at', cursor.createdAt)
    }
    const [{ count, error: countError }, { data, error }] = await Promise.all([
      countQuery,
      query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1),
    ])
    if (countError) throwDbError(countError, 'audit.listByBuilding.count')
    if (error) throwDbError(error, 'audit.listByBuilding')
    const rows = (data ?? []).map(mapAuditEvent)
    const items = rows.slice(0, limit)
    return {
      items,
      total: count ?? 0,
      nextCursor: rows.length > limit && items.length > 0
        ? encodeAuditCursor(items[items.length - 1]!)
        : null,
    }
  },

  async listAll(
    event: H3Event,
    opts?: AuditListOptions,
  ): Promise<{ items: AuditEvent[], total: number, nextCursor: string | null }> {
    const client = await serverSupabaseClient(event)
    const limit = opts?.limit ?? 50
    const cursor = decodeAuditCursor(opts?.cursor)
    let countQuery = client
      .from('audit_events')
      .select('id', { count: 'exact', head: true })
    let query = client
      .from('audit_events')
      .select('*')
    if (opts?.entityType) {
      countQuery = countQuery.eq('entity_type', opts.entityType)
      query = query.eq('entity_type', opts.entityType)
    }
    if (opts?.entityId) {
      countQuery = countQuery.eq('entity_id', opts.entityId)
      query = query.eq('entity_id', opts.entityId)
    }
    if (opts?.correlationId) {
      countQuery = countQuery.eq('correlation_id', opts.correlationId)
      query = query.eq('correlation_id', opts.correlationId)
    }
    if (cursor.createdAt) {
      query = cursor.id
        ? query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
        : query.lt('created_at', cursor.createdAt)
    }
    const [{ count, error: countError }, { data, error }] = await Promise.all([
      countQuery,
      query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1),
    ])
    if (countError) throwDbError(countError, 'audit.listAll.count')
    if (error) throwDbError(error, 'audit.listAll')
    const rows = (data ?? []).map(mapAuditEvent)
    const items = rows.slice(0, limit)
    return {
      items,
      total: count ?? 0,
      nextCursor: rows.length > limit && items.length > 0
        ? encodeAuditCursor(items[items.length - 1]!)
        : null,
    }
  },
}
