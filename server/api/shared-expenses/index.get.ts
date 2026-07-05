import { SharedExpenseService } from '../../services/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const items = await SharedExpenseService.list(event, user)
  return { data: items }
})
