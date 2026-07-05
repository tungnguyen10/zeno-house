import { SharedExpenseService } from '../../services/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  await SharedExpenseService.remove(event, user, id)
  return { data: { id } }
})
