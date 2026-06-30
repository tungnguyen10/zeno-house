import { AssignmentRepository } from '../../repositories/assignments'
import { assignmentUpdateSchema } from '~/utils/validators/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (user.app_metadata.role !== 'admin') throwForbidden('Chỉ admin được quản lý phân quyền')

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = assignmentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu phân quyền không hợp lệ', parsed.error.flatten())
  }

  return { data: await AssignmentRepository.update(event, id, parsed.data) }
})
