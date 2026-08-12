import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import { AuditOperationRepository } from '../repositories/audit-operations'
import { reportAuditMetric } from '../utils/audit-telemetry'
import { sanitizeAuditPayload } from './audit'

export const AuditOperationService = {
  async begin(event: H3Event, input: {
    idempotencyKey: string
    actorId: string | null
    buildingId: string | null
    action: string
    entityType: string
    entityId?: string | null
    intentData?: Record<string, unknown>
  }) {
    return AuditOperationRepository.begin(event, {
      ...input,
      intentData: sanitizeAuditPayload(input.intentData) as Record<string, unknown> | undefined,
    })
  },
  async complete(event: H3Event, operationId: string, input: {
    outcomeData?: Record<string, unknown>
    beforeData?: unknown
    afterData?: unknown
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await AuditOperationRepository.complete(event, operationId, {
      outcomeData: sanitizeAuditPayload(input.outcomeData) as Record<string, unknown> | undefined,
      beforeData: sanitizeAuditPayload(input.beforeData),
      afterData: sanitizeAuditPayload(input.afterData),
      metadata: sanitizeAuditPayload(input.metadata) as Record<string, unknown> | undefined,
    })
  },

  async reconcile(event: H3Event, limit = 20): Promise<{ claimed: number, unresolved: number }> {
    const operations = await AuditOperationRepository.claimStale(event, randomUUID(), limit)
    let unresolved = 0
    for (const operation of operations) {
      reportAuditMetric('audit.operation_stale', {
        operationId: operation.id,
        action: operation.action,
        attemptCount: operation.attemptCount,
      })
      try {
        // External outcomes are provider-specific. Unknown stale intents are
        // retained for investigation instead of being guessed as successful.
        await AuditOperationRepository.markUnresolved(event, operation.id, 'OUTCOME_REQUIRES_VERIFICATION')
        unresolved++
      }
      catch (error) {
        reportAuditMetric('audit.reconciliation_failed', {
          operationId: operation.id,
          errorType: error instanceof Error ? error.name : typeof error,
        })
      }
    }
    return { claimed: operations.length, unresolved }
  },
}
