import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingAuditEvent } from '~/types/billing'
import type { BillingAuditEntityType } from '~/utils/constants/billing'
import { BillingAuditRepository } from '../../repositories/billing/audit'
import { formatAuditSummary } from './audit-summary'
import { BillingDisplayResolver } from './display'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { assertBuildingScope } from '../../utils/scope'

declare const process: { env?: Record<string, string | undefined> }

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
    const billingPeriod = await BillingPeriodRepository.findById(event, billingPeriodId)
    if (!billingPeriod) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, billingPeriod.buildingId, 'read')
    const events = await BillingAuditRepository.listByPeriod(event, billingPeriodId)
    const resolver = new BillingDisplayResolver(event)
    const period = (await resolver.loadPeriods([billingPeriodId])).get(billingPeriodId)
    const ctx = period
      ? {
          buildingId: period.buildingId,
          periodToken: `${period.periodYear}-${String(period.periodMonth).padStart(2, '0')}`,
        }
      : {}

    await resolver.loadActors(events.map(item => item.actorId))
    const invoiceIds = events
      .filter(item => item.entityType === 'invoice')
      .map(item => item.entityId)
    const invoices = await resolver.loadInvoices(invoiceIds)
    await Promise.all([
      resolver.loadTenants([...invoices.values()].map(invoice => invoice?.tenantId)),
      resolver.loadRooms([...invoices.values()].map(invoice => invoice?.roomId)),
      resolver.loadPeriods([
        billingPeriodId,
        ...[...invoices.values()].map(invoice => invoice?.billingPeriodId),
      ]),
    ])

    const enriched = await Promise.all(events.map(async (item) => {
      const actor = item.actorId
        ? (await resolver.loadActors([item.actorId])).get(item.actorId)
        : null
      const entity = await resolver.entityLabel(item.entityType, item.entityId, ctx)
      return {
        ...item,
        actorName: actor?.name ?? null,
        actorEmail: actor?.email ?? null,
        entityLabel: entity.label,
        entitySubLabel: entity.subLabel,
        entityHref: await resolver.entityHref(item.entityType, item.entityId, ctx),
        summary: formatAuditSummary(item.action, item.metadata, item.beforeData, item.afterData),
      }
    }))

    if (process.env?.BILLING_DISPLAY_DEBUG === '1') {
      console.warn('[billing-display-resolver]', {
        scope: 'audit.listByPeriod',
        billingPeriodId,
        eventCount: events.length,
        queryCounts: resolver.stats(),
      })
    }

    return enriched
  },
}
