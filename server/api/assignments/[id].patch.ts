import { AssignmentService } from '../../services/assignments'
import { assignmentUpdateSchema } from '~/utils/validators/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = assignmentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu phân quyền không hợp lệ', parsed.error.flatten())
  }

  return { data: await AssignmentService.update(event, user, id, parsed.data) }
})
