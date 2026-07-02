import { AssignmentService } from '../../services/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  await AssignmentService.remove(event, user, id)
  setResponseStatus(event, 204)
})
