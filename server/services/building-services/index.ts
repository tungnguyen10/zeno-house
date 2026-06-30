import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingService } from '~/types/building-services'
import type { BuildingServiceUpsertInput, BuildingServiceUpdateInput } from '~/utils/validators/building-services'
import { BuildingServiceRepository } from '../../repositories/building-services'
import { BuildingRepository } from '../../repositories/buildings'
import { assertBuildingScope } from '../../utils/scope'

export const BuildingServiceService = {
  async list(event: H3Event, _user: AuthUser, buildingId: string): Promise<BuildingService[]> {
    if (!can(_user, 'building-services.read')) throwForbidden('Không có quyền xem dịch vụ tòa nhà')
    const building = await BuildingRepository.findByIdentifier(event, buildingId)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, _user, building.id, 'read')
    return BuildingServiceRepository.findByBuilding(event, building.id)
  },

  async upsert(event: H3Event, _user: AuthUser, input: BuildingServiceUpsertInput): Promise<BuildingService> {
    if (!can(_user, 'building-services.write')) throwForbidden('Không có quyền cập nhật dịch vụ tòa nhà')
    const building = await BuildingRepository.findByIdentifier(event, input.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, _user, building.id, 'write')
    return BuildingServiceRepository.upsert(event, { ...input, building_id: building.id })
  },

  async update(event: H3Event, _user: AuthUser, id: string, input: BuildingServiceUpdateInput): Promise<BuildingService> {
    if (!can(_user, 'building-services.write')) throwForbidden('Không có quyền cập nhật dịch vụ tòa nhà')
    const existing = await BuildingServiceRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy dịch vụ tòa nhà')
    await assertBuildingScope(event, _user, existing.buildingId, 'write')
    return BuildingServiceRepository.update(event, id, input)
  },
}
