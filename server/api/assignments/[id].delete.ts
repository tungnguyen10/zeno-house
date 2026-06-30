import { AssignmentRepository } from '../../repositories/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (user.app_metadata.role !== 'admin') throwForbidden('Chỉ admin được quản lý phân quyền')

  const id = getRouterParam(event, 'id')!
  await AssignmentRepository.remove(event, id)
  setResponseStatus(event, 204)
})
