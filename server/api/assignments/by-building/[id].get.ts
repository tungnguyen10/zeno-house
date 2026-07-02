import { AssignmentRepository } from '../../../repositories/assignments'
import { BuildingRepository } from '../../../repositories/buildings'
import { assertBuildingScope } from '../../../utils/scope'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (!can(user, 'users.manage.global') && !can(user, 'users.manage.scoped')) {
    throwForbidden('Không có quyền quản lý phân quyền')
  }
  const id = getRouterParam(event, 'id')!
  const building = await BuildingRepository.findByIdentifier(event, id)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  await assertBuildingScope(event, user, building.id, 'read')

  return { data: await AssignmentRepository.findManagersByBuilding(event, building.id) }
})
