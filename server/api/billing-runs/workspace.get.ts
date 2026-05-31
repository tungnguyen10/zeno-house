import { BillingRunService } from '../../services/billing-runs'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  if (!query.building_id || !query.year || !query.month) {
    throw createError({ statusCode: 400, message: 'building_id, year, month are required' })
  }

  const workspace = await BillingRunService.loadWorkspace(
    event,
    user,
    String(query.building_id),
    Number(query.year),
    Number(query.month),
  )

  return { data: workspace }
})
