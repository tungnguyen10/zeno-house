import { AssignmentService } from '../../services/assignments'
import { assignmentCreateSchema } from '~/utils/validators/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const parsed = assignmentCreateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu phân quyền không hợp lệ', parsed.error.flatten())
  }

  const assignment = await AssignmentService.create(event, user, parsed.data)
  setResponseStatus(event, 201)
  return { data: assignment }
})
