import { BillingPeriodService } from '../../services/billing-periods'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const buildingId = query.building_id ? String(query.building_id) : undefined
  const year = query.year ? Number(query.year) : undefined

  const periods = await BillingPeriodService.listSummary(event, user, { buildingId, year })
  return { data: periods }
})
