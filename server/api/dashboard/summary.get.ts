import { DashboardService } from '../../services/dashboard'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return DashboardService.getSummary(event, user)
})
