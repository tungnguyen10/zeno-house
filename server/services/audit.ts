import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { AuditEntityType } from '~/utils/constants/audit'
import { Buffer } from 'node:buffer'
import { AuditRepository } from '../repositories/audit'

export interface AuditAppendOptions {
  building_id: string | null
  action: string
  entity_type: AuditEntityType
  entity_id?: string | null
  correlation_id?: string | null
  before_data?: unknown
  after_data?: unknown
  metadata?: Record<string, unknown>
}

function auditErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' || typeof code === 'number' ? String(code) : null
}

function isPrivateAuditKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return normalized.includes('password')
    || normalized.includes('token')
    || normalized.includes('session')
    || normalized.includes('signedurl')
    || normalized === 'binary'
}

export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    try {
      const url = new URL(value)
      const hasCredential = [...url.searchParams.keys()].some((key) => {
        const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
        return normalized.includes('token') || normalized.includes('signature') || normalized.includes('credential')
      })
      if (hasCredential) return undefined
    }
    catch {
      // Ordinary strings are not URLs and are safe to preserve.
    }
    return value
  }
  if (depth >= 12) return '[TRUNCATED]'
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return undefined
  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeAuditPayload(item, depth + 1))
      .filter(item => item !== undefined)
  }
  if (typeof value !== 'object') return String(value)

  const sanitized: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isPrivateAuditKey(key)) continue
    const safeChild = sanitizeAuditPayload(child, depth + 1)
    if (safeChild !== undefined) sanitized[key] = safeChild
  }
  return sanitized
}

function reportAuditFailure(
  operation: string,
  context: {
    action: string
    entityType: AuditEntityType
    entityId?: string | null
    buildingId?: string | null
  },
  error: unknown,
): void {
  console.error(`[AuditService] ${operation} failed`, {
    action: context.action,
    entityType: context.entityType,
    entityId: context.entityId ?? null,
    buildingId: context.buildingId ?? null,
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode: auditErrorCode(error),
  })
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
  async append(event: H3Event, user: AuthUser | null, input: AuditAppendOptions): Promise<void> {
    try {
      await AuditRepository.append(event, {
        building_id: input.building_id,
        actor_id: user?.id ?? null,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        correlation_id: input.correlation_id ?? null,
        before_data: sanitizeAuditPayload(input.before_data),
        after_data: sanitizeAuditPayload(input.after_data),
        metadata: sanitizeAuditPayload(input.metadata) as Record<string, unknown> | undefined,
      })
    }
    catch (err) {
      reportAuditFailure('append', {
        action: input.action,
        entityType: input.entity_type,
        entityId: input.entity_id,
        buildingId: input.building_id,
      }, err)
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
      reportAuditFailure('appendBulk parent', {
        action: opts.aggregate_action,
        entityType: opts.entity_type,
        buildingId: opts.building_id,
      }, err)
      return
    }

    const succeeded = new Set(opts.succeeded)
    try {
      await AuditRepository.appendMany(
        event,
        opts.items.filter(item => succeeded.has(item.entity_id)).map(item => ({
          building_id: item.building_id !== undefined ? item.building_id : opts.building_id,
          actor_id: user.id ?? null,
          action: item.action,
          entity_type: opts.entity_type,
          entity_id: item.entity_id,
          correlation_id: parentId,
          before_data: sanitizeAuditPayload(item.before_data),
          after_data: sanitizeAuditPayload(item.after_data),
        })),
      )
    }
    catch (err) {
      reportAuditFailure('appendBulk children', {
        action: opts.aggregate_action,
        entityType: opts.entity_type,
        buildingId: opts.building_id,
      }, err)
    }
  },
}
