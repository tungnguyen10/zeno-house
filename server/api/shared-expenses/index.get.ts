import { SharedExpenseService } from '../../services/shared-expenses'
import { sharedExpenseListQuerySchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = parseQuery(event, sharedExpenseListQuerySchema)
  const items = await SharedExpenseService.list(event, user, input)
  return {
    data: items,
    meta: { periodYear: input.period_year, periodMonth: input.period_month },
  }
})
