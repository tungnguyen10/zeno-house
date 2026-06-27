import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Room } from '~/types/rooms'
import type {
  RoomBulkActionInput,
  RoomCreateInput,
  RoomUpdateInput,
} from '~/utils/validators/rooms'
import { RoomRepository, type RoomFilters } from '../../repositories/rooms'
import { BuildingRepository } from '../../repositories/buildings'

export interface RoomBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export const RoomService = {
  async list(
    event: H3Event,
    user: AuthUser,
    filters: RoomFilters,
  ): Promise<{ items: Room[]; total: number }> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem danh sách phòng')
    let buildingId = filters.buildingId
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      buildingId = building.id
    }
    return RoomRepository.findAll(event, { ...filters, buildingId })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Room> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem phòng')
    const room = await RoomRepository.findByIdentifier(event, id)
    if (!room) throwNotFound('Không tìm thấy phòng')
    return room
  },

  async getByBuildingAndRoomSlug(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    roomSlug: string,
  ): Promise<Room> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem phòng')
    const building = await BuildingRepository.findByIdentifier(event, buildingIdentifier)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    const room = await RoomRepository.findByBuildingAndRoomSlug(event, building.id, roomSlug)
    if (!room) throwNotFound('Không tìm thấy phòng')
    return room
  },

  async create(event: H3Event, user: AuthUser, input: RoomCreateInput): Promise<Room> {
    if (!can(user, 'rooms.create')) throwForbidden('Không có quyền tạo phòng')
    return RoomRepository.insert(event, input)
  },

  async update(event: H3Event, user: AuthUser, id: string, input: RoomUpdateInput): Promise<Room> {
    if (!can(user, 'rooms.update')) throwForbidden('Không có quyền cập nhật phòng')
    const existing = await RoomRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy phòng')
    return RoomRepository.update(event, existing.id, input)
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    id: string,
    opts: { force?: boolean } = {},
  ): Promise<Room | undefined> {
    if (!can(user, 'rooms.delete')) throwForbidden('Không có quyền xoá phòng')
    const existing = await RoomRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy phòng')

    if (opts.force) {
      return RoomRepository.softArchive(event, existing.id)
    }

    const [activeContracts, meterReadings] = await Promise.all([
      RoomRepository.countActiveContractsForRoom(event, existing.id),
      RoomRepository.countMeterReadingsForRoom(event, existing.id),
    ])

    if (activeContracts > 0 || meterReadings > 0) {
      throw createError({
        statusCode: 409,
        data: {
          error: {
            code: 'CONFLICT',
            message: 'Phòng còn ràng buộc, không thể xoá',
            details: { activeContracts, meterReadings },
          },
        },
      })
    }

    await RoomRepository.remove(event, existing.id)
    return undefined
  },

  async bulkAction(
    event: H3Event,
    user: AuthUser,
    input: RoomBulkActionInput,
  ): Promise<RoomBulkResult> {
    if (!can(user, 'rooms.delete')) throwForbidden('Không có quyền thao tác hàng loạt')

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []

    for (const id of input.ids) {
      try {
        if (input.action === 'delete') {
          await RoomService.remove(event, user, id)
          succeeded.push(id)
          continue
        }

        const existing = await RoomRepository.findByIdentifier(event, id)
        if (!existing) {
          failed.push({ id, reason: 'not_found' })
          continue
        }

        if (input.action === 'archive') {
          await RoomRepository.softArchive(event, existing.id)
        }
        else if (input.action === 'activate') {
          await RoomRepository.update(event, existing.id, { status: 'available' })
        }
        else if (input.action === 'set_maintenance') {
          await RoomRepository.update(event, existing.id, { status: 'maintenance' })
        }
        succeeded.push(id)
      }
      catch (err: unknown) {
        const e = err as { data?: { error?: { code?: string; details?: { activeContracts?: number; meterReadings?: number } } }; message?: string }
        const code = e?.data?.error?.code
        if (code === 'CONFLICT') {
          const details = e?.data?.error?.details
          if (details?.activeContracts && details.activeContracts > 0) failed.push({ id, reason: 'has_active_contracts' })
          else if (details?.meterReadings && details.meterReadings > 0) failed.push({ id, reason: 'has_meter_readings' })
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
