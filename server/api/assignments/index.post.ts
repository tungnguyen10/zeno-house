import { AssignmentRepository } from '../../repositories/assignments'
import { assignmentCreateSchema } from '~/utils/validators/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (user.app_metadata.role !== 'admin') throwForbidden('Chỉ admin được quản lý phân quyền')

  const body = await readBody(event)
  const parsed = assignmentCreateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu phân quyền không hợp lệ', parsed.error.flatten())
  }

  const assignment = await AssignmentRepository.insert(event, {
    ...parsed.data,
    created_by: user.id ?? null,
  })
  setResponseStatus(event, 201)
  return { data: assignment }
})
