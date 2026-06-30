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
import { assertBuildingScope, canDeleteMasterData, getAssignedBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

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
    const buildingIds = await getAssignedBuildingIds(event, user)
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      if (buildingIds && !buildingIds.includes(building.id)) {
        return { items: [], total: 0 }
      }
      buildingId = building.id
    }
    return RoomRepository.findAll(event, { ...filters, buildingId, buildingIds })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Room> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem phòng')
    const room = await RoomRepository.findByIdentifier(event, id)
    if (!room) throwNotFound('Không tìm thấy phòng')
    await assertBuildingScope(event, user, room.buildingId, 'read')
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
    await assertBuildingScope(event, user, building.id, 'read')
    const room = await RoomRepository.findByBuildingAndRoomSlug(event, building.id, roomSlug)
    if (!room) throwNotFound('Không tìm thấy phòng')
    return room
  },

  async create(event: H3Event, user: AuthUser, input: RoomCreateInput): Promise<Room> {
    if (!can(user, 'rooms.create')) throwForbidden('Không có quyền tạo phòng')
    await assertBuildingScope(event, user, input.building_id, 'write')
    const result = await RoomRepository.insert(event, input)
    await AuditService.append(event, user, {
      building_id: result.buildingId,
      action: AUDIT_ACTIONS.ROOM_CREATED,
      entity_type: 'room',
      entity_id: result.id,
      after_data: result,
    })
    return result
  },

  async update(event: H3Event, user: AuthUser, id: string, input: RoomUpdateInput): Promise<Room> {
    if (!can(user, 'rooms.update')) throwForbidden('Không có quyền cập nhật phòng')
    const existing = await RoomRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy phòng')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    const updated = await RoomRepository.update(event, existing.id, input)
    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: AUDIT_ACTIONS.ROOM_UPDATED,
      entity_type: 'room',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })
    return updated
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    id: string,
    opts: { force?: boolean; reason: string },
  ): Promise<Room | undefined> {
    const existing = await RoomRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy phòng')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (!await canDeleteMasterData(event, user, existing.buildingId)) {
      throwForbidden('Không có quyền xoá phòng trong tòa nhà này')
    }

    if (opts.force) {
      const archived = await RoomRepository.softArchive(event, existing.id)
      await AuditService.append(event, user, {
        building_id: existing.buildingId,
        action: AUDIT_ACTIONS.ROOM_ARCHIVED,
        entity_type: 'room',
        entity_id: existing.id,
        before_data: existing,
        after_data: archived,
        metadata: { reason: opts.reason },
      })
      return archived
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
    await AuditService.append(event, user, {
      building_id: existing.buildingId,
      action: AUDIT_ACTIONS.ROOM_REMOVED,
      entity_type: 'room',
      entity_id: existing.id,
      before_data: existing,
      metadata: { reason: opts.reason },
    })
    return undefined
  },

  async bulkAction(
    event: H3Event,
    user: AuthUser,
    input: RoomBulkActionInput,
  ): Promise<RoomBulkResult> {
    if (!can(user, 'rooms.update')) throwForbidden('Không có quyền thao tác hàng loạt')

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []

    for (const id of input.ids) {
      try {
        if (input.action === 'delete') {
          await RoomService.remove(event, user, id, { reason: input.reason! })
          succeeded.push(id)
          continue
        }

        const existing = await RoomRepository.findByIdentifier(event, id)
        if (!existing) {
          failed.push({ id, reason: 'not_found' })
          continue
        }

        if (input.action === 'archive') {
          await assertBuildingScope(event, user, existing.buildingId, 'write')
          await RoomRepository.softArchive(event, existing.id)
        }
        else if (input.action === 'activate') {
          await assertBuildingScope(event, user, existing.buildingId, 'write')
          await RoomRepository.update(event, existing.id, { status: 'available' })
        }
        else if (input.action === 'set_maintenance') {
          await assertBuildingScope(event, user, existing.buildingId, 'write')
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

    const bulkActionCode = (
      input.action === 'archive' ? AUDIT_ACTIONS.ROOM_ARCHIVED
      : input.action === 'activate' ? AUDIT_ACTIONS.ROOM_ACTIVATED
      : input.action === 'set_maintenance' ? AUDIT_ACTIONS.ROOM_MAINTENANCE_SET
      : AUDIT_ACTIONS.ROOM_REMOVED
    )
    await AuditService.appendBulk(event, user, {
      building_id: null,
      entity_type: 'room',
      aggregate_action: `room.bulk_${input.action}`,
      items: succeeded.map(id => ({ entity_id: id, action: bulkActionCode })),
      succeeded,
      total: input.ids.length,
      failed: failed.length,
    })

    return { succeeded, failed }
  },
}
