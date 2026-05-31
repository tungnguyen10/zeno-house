import { BillingItemService } from '../../services/billing-items'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  if (!query.billing_run_id && !query.room_id) {
    throw createError({ statusCode: 400, message: 'billing_run_id or room_id is required' })
  }

  const items = await BillingItemService.listItems(
    event,
    user,
    query.billing_run_id ? String(query.billing_run_id) : null,
    {
      payment_status: query.payment_status as 'paid' | 'unpaid' | undefined,
      q: query.q ? String(query.q) : undefined,
      room_id: query.room_id ? String(query.room_id) : undefined,
    },
  )

  return { data: items }
})
