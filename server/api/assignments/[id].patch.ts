import { AssignmentService } from '../../services/assignments'
import { assignmentUpdateSchema } from '~/utils/validators/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, assignmentUpdateSchema, 'Dữ liệu phân quyền không hợp lệ')

  return { data: await AssignmentService.update(event, user, id, input) }
})
