import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Building } from '~/types/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { BuildingRepository } from '../../repositories/buildings'

export const BuildingService = {
  async list(
    event: H3Event,
    user: AuthUser,
    opts: { page: number; limit: number },
  ): Promise<{ items: Building[]; total: number }> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem danh sách tòa nhà')
    return BuildingRepository.findAll(event, opts)
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Building> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem tòa nhà')
    const building = await BuildingRepository.findByIdentifier(event, id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    return building
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: BuildingCreateInput,
  ): Promise<Building> {
    if (!can(user, 'buildings.create')) throwForbidden('Không có quyền tạo tòa nhà')
    return BuildingRepository.insert(event, input)
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: BuildingUpdateInput,
  ): Promise<Building> {
    if (!can(user, 'buildings.update')) throwForbidden('Không có quyền cập nhật tòa nhà')
    const existing = await BuildingRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy tòa nhà')
    return BuildingRepository.update(event, existing.id, input)
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'buildings.delete')) throwForbidden('Không có quyền xoá tòa nhà')
    const existing = await BuildingRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy tòa nhà')
    return BuildingRepository.remove(event, existing.id)
  },
}
