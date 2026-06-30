import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingService } from '~/types/building-services'
import type { BuildingServiceUpsertInput, BuildingServiceUpdateInput } from '~/utils/validators/building-services'
import { BuildingServiceRepository } from '../../repositories/building-services'
import { BuildingRepository } from '../../repositories/buildings'
import { assertBuildingScope, canDeleteMasterData } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

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

  async remove(event: H3Event, user: AuthUser, id: string, opts: { reason: string }): Promise<void> {
    const existing = await BuildingServiceRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy dịch vụ tòa nhà')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (!await canDeleteMasterData(event, user, existing.buildingId)) {
      throwForbidden('Không có quyền xoá dịch vụ trong tòa nhà này')
    }
    await BuildingServiceRepository.remove(event, id)
    await AuditService.append(event, user, {
      building_id: existing.buildingId,
      action: AUDIT_ACTIONS.BUILDING_SERVICE_REMOVED,
      entity_type: 'building_service',
      entity_id: existing.id,
      before_data: existing,
      metadata: { reason: opts.reason },
    })
  },
}
