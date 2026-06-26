import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Tenant } from '~/types/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'
import { TenantRepository, type TenantFilters } from '../../repositories/tenants'
import { BuildingRepository } from '../../repositories/buildings'

export const TenantService = {
  async list(
    event: H3Event,
    user: AuthUser,
    filters: TenantFilters,
  ): Promise<{ items: Tenant[]; total: number }> {
    if (!can(user, 'tenants.read')) throwForbidden('Không có quyền xem danh sách khách thuê')
    let buildingId = filters.building_id
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      buildingId = building.id
    }
    return TenantRepository.findAll(event, { ...filters, building_id: buildingId })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Tenant> {
    if (!can(user, 'tenants.read')) throwForbidden('Không có quyền xem khách thuê')
    const tenant = await TenantRepository.findByIdentifier(event, id)
    if (!tenant) throwNotFound('Không tìm thấy khách thuê')
    return tenant
  },

  async create(event: H3Event, user: AuthUser, input: TenantCreateInput): Promise<Tenant> {
    if (!can(user, 'tenants.create')) throwForbidden('Không có quyền tạo khách thuê')
    if (input.id_number) {
      const existing = await TenantRepository.findByIdNumber(event, input.id_number)
      if (existing) throwConflict('Số CMND/CCCD đã tồn tại')
    }
    return TenantRepository.insert(event, input)
  },

  async update(event: H3Event, user: AuthUser, id: string, input: TenantUpdateInput): Promise<Tenant> {
    if (!can(user, 'tenants.update')) throwForbidden('Không có quyền cập nhật khách thuê')
    const existing = await TenantRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy khách thuê')
    if (input.id_number) {
      const conflict = await TenantRepository.findByIdNumber(event, input.id_number, existing.id)
      if (conflict) throwConflict('Số CMND/CCCD đã tồn tại')
    }
    return TenantRepository.update(event, existing.id, input)
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'tenants.delete')) throwForbidden('Không có quyền xoá khách thuê')
    const existing = await TenantRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy khách thuê')
    return TenantRepository.remove(event, existing.id)
  },
}
