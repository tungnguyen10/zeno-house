import { AssignmentService } from '../../services/assignments'
import { assignmentCreateSchema } from '~/utils/validators/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, assignmentCreateSchema, 'Dữ liệu phân quyền không hợp lệ')

  const assignment = await AssignmentService.create(event, user, input)
  setResponseStatus(event, 201)
  return { data: assignment }
})
