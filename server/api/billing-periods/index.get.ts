import { BillingPeriodService } from '../../services/billing-periods'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  if (!query.building_id) {
    throw createError({ statusCode: 400, message: 'building_id is required' })
  }

  const periods = await BillingPeriodService.list(event, user, String(query.building_id))
  return { data: periods }
})
