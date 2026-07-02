import { AssignmentService } from '../../services/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await AssignmentService.list(event, user) }
})
