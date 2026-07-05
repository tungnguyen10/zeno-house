import { PrepaidExpenseService } from '../../services/operations-report/prepaid-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  await PrepaidExpenseService.delete(event, user, id)
  setResponseStatus(event, 204)
})
