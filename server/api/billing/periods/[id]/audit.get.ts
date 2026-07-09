import { BillingAuditService } from '../../../../services/billing/audit'
import { billingAuditListQuerySchema } from '~/utils/validators/billing-audit'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const { actor, category, from, to, q, correlation_id, cursor, limit } = parseQuery(event, billingAuditListQuerySchema, 'Tham số không hợp lệ')
  const { items, nextCursor } = await BillingAuditService.listByPeriodFiltered(event, user, id!, {
    actorIds: actor,
    categories: category,
    from,
    to,
    q,
    correlationId: correlation_id,
    cursor,
    limit,
  })

  return { data: items, meta: { total: items.length, nextCursor } }
})
