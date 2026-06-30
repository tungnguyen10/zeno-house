import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { AuditEntityType } from '~/utils/constants/audit'
import { AuditRepository } from '../repositories/audit'

declare const process: { env?: Record<string, string | undefined> }

export interface AuditAppendOptions {
  building_id: string | null
  action: string
  entity_type: AuditEntityType
  entity_id?: string | null
  before_data?: unknown
  after_data?: unknown
  metadata?: Record<string, unknown>
}

export interface BulkAuditItem {
  entity_id: string
  action: string
  building_id?: string | null
  before_data?: unknown
  after_data?: unknown
}

export const AuditService = {
  /**
   * Append a single audit event. Errors are caught and logged — never
   * re-thrown so that audit failure cannot break the main operation.
   */
  async append(event: H3Event, user: AuthUser, input: AuditAppendOptions): Promise<void> {
    try {
      await AuditRepository.append(event, {
        building_id: input.building_id,
        actor_id: user.id ?? null,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        before_data: input.before_data,
        after_data: input.after_data,
        metadata: input.metadata,
      })
    }
    catch (err) {
      if (process.env?.NODE_ENV !== 'production') {
        console.error('[AuditService] append failed (silent):', err)
      }
    }
  },

  /**
   * Append a bulk action audit: one aggregate parent event + one per-entity
   * child event for each succeeded entity (linked by correlation_id).
   * Errors on individual children are caught and logged individually.
   */
  async appendBulk(
    event: H3Event,
    user: AuthUser,
    opts: {
      building_id: string | null
      entity_type: AuditEntityType
      aggregate_action: string
      items: BulkAuditItem[]
      succeeded: string[]
      total: number
      failed: number
    },
  ): Promise<void> {
    let parentId: string | null = null

    try {
      const parent = await AuditRepository.append(event, {
        building_id: opts.building_id,
        actor_id: user.id ?? null,
        action: opts.aggregate_action,
        entity_type: opts.entity_type,
        entity_id: null,
        metadata: {
          total: opts.total,
          succeeded: opts.succeeded.length,
          failed: opts.failed,
        },
      })
      parentId = parent.id
    }
    catch (err) {
      if (process.env?.NODE_ENV !== 'production') {
        console.error('[AuditService] appendBulk parent failed (silent):', err)
      }
      return
    }

    for (const item of opts.items) {
      if (!opts.succeeded.includes(item.entity_id)) continue
      try {
        await AuditRepository.append(event, {
          building_id: item.building_id !== undefined ? item.building_id : opts.building_id,
          actor_id: user.id ?? null,
          action: item.action,
          entity_type: opts.entity_type,
          entity_id: item.entity_id,
          correlation_id: parentId,
          before_data: item.before_data,
          after_data: item.after_data,
        })
      }
      catch (err) {
        if (process.env?.NODE_ENV !== 'production') {
          console.error(`[AuditService] appendBulk child ${item.entity_id} failed (silent):`, err)
        }
      }
    }
  },
}
