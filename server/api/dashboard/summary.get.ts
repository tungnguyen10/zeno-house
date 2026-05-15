import { DashboardService } from '../../services/dashboard'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const summary = await DashboardService.getSummary(event, user)
  return { data: summary }
})
