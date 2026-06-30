import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Building } from '~/types/buildings'
import type {
  BuildingBulkActionInput,
  BuildingCreateInput,
  BuildingUpdateInput,
} from '~/utils/validators/buildings'
import { BuildingRepository } from '../../repositories/buildings'
import { assertBuildingScope, getAssignedBuildingIds } from '../../utils/scope'

export interface BuildingListOptions {
  page: number
  limit: number
  q?: string
  status?: ('active' | 'inactive')[]
  sort?: 'name' | 'created_at' | 'total_rooms'
  order?: 'asc' | 'desc'
  buildingIds?: string[] | null
}

export interface BuildingBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export const BuildingService = {
  async list(
    event: H3Event,
    user: AuthUser,
    opts: BuildingListOptions,
  ): Promise<{ items: Building[]; total: number }> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem danh sách tòa nhà')
    const buildingIds = await getAssignedBuildingIds(event, user)
    return BuildingRepository.findAll(event, { ...opts, buildingIds })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Building> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem tòa nhà')
    const building = await BuildingRepository.findByIdentifier(event, id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, building.id, 'read')
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
    await assertBuildingScope(event, user, existing.id, 'write')
    return BuildingRepository.update(event, existing.id, input)
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    id: string,
    opts: { force?: boolean } = {},
  ): Promise<Building | undefined> {
    if (!can(user, 'buildings.delete')) throwForbidden('Không có quyền xoá tòa nhà')
    const existing = await BuildingRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, existing.id, 'write')

    if (opts.force) {
      return BuildingRepository.softArchive(event, existing.id)
    }

    const [rooms, activeContracts] = await Promise.all([
      BuildingRepository.countRoomsForBuilding(event, existing.id),
      BuildingRepository.countActiveContractsForBuilding(event, existing.id),
    ])

    if (rooms > 0 || activeContracts > 0) {
      throw createError({
        statusCode: 409,
        data: {
          error: {
            code: 'CONFLICT',
            message: 'Toà nhà còn ràng buộc, không thể xoá',
            details: { rooms, activeContracts },
          },
        },
      })
    }

    await BuildingRepository.remove(event, existing.id)
    return undefined
  },

  async bulkAction(
    event: H3Event,
    user: AuthUser,
    input: BuildingBulkActionInput,
  ): Promise<BuildingBulkResult> {
    if (!can(user, 'buildings.delete')) throwForbidden('Không có quyền thao tác hàng loạt')

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []

    for (const id of input.ids) {
      try {
        if (input.action === 'delete') {
          await BuildingService.remove(event, user, id)
          succeeded.push(id)
          continue
        }

        const existing = await BuildingRepository.findByIdentifier(event, id)
        if (!existing) {
          failed.push({ id, reason: 'not_found' })
          continue
        }

        if (input.action === 'archive') {
          await BuildingRepository.softArchive(event, existing.id)
        }
        else if (input.action === 'activate') {
          await BuildingRepository.update(event, existing.id, { status: 'active' })
        }
        succeeded.push(id)
      }
      catch (err: unknown) {
        const e = err as { data?: { error?: { code?: string; details?: { rooms?: number; activeContracts?: number } } }; message?: string }
        const code = e?.data?.error?.code
        if (code === 'CONFLICT') {
          const details = e?.data?.error?.details
          if (details?.rooms && details.rooms > 0) failed.push({ id, reason: 'has_rooms' })
          else if (details?.activeContracts && details.activeContracts > 0) failed.push({ id, reason: 'has_active_contracts' })
          else failed.push({ id, reason: 'conflict' })
        }
        else if (code === 'NOT_FOUND') {
          failed.push({ id, reason: 'not_found' })
        }
        else {
          failed.push({ id, reason: e?.message ?? 'error' })
        }
      }
    }

    return { succeeded, failed }
  },
}
