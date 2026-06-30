import { AssignmentRepository } from '../../repositories/assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (user.app_metadata.role !== 'admin') throwForbidden('Chỉ admin được quản lý phân quyền')

  return { data: await AssignmentRepository.findAllWithBuildings(event) }
})
