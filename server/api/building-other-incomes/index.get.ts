import { BuildingOtherIncomeService } from '../../services/operations-report/other-incomes'
import { operationsReportQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseQuery(event, operationsReportQuerySchema)
  return { data: await BuildingOtherIncomeService.list(event, user, input) }
})
