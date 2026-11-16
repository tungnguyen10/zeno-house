import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { Building } from '~/types/buildings'
import type {
  BuildingBulkActionInput,
  BuildingCreateWithRoomsInput,
  BuildingUpdateInput,
  BuildingVisibilityInput,
} from '~/utils/validators/buildings'
import { BuildingRepository } from '../../repositories/buildings'
import { BulkActionRepository } from '../../repositories/bulk-actions'
import { assertBuildingScope, getAssignedBuildingIds, getVisibleBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

export interface BuildingListOptions {
  page: number
  limit: number
  q?: string
  status?: ('active' | 'inactive')[]
  include_hidden?: boolean
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
    requireCapability(user, 'buildings.read', 'Không có quyền xem danh sách tòa nhà')
    if (opts.include_hidden) {
      requireCapability(user, 'buildings.visibility.manage', 'Không có quyền xem tòa nhà đang ẩn')
    }
    const buildingIds = opts.include_hidden
      ? await getAssignedBuildingIds(event, user)
      : await getVisibleBuildingIds(event, user)
    return BuildingRepository.findAll(event, { ...opts, buildingIds })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Building> {
    requireCapability(user, 'buildings.read', 'Không có quyền xem tòa nhà')
    const building = await BuildingRepository.findByIdentifier(event, id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, building.id, 'read')
    return building
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: BuildingCreateWithRoomsInput,
  ): Promise<{ building: Building; roomCount: number }> {
    requireCapability(user, 'buildings.create', 'Không có quyền tạo tòa nhà')
    const { rooms = [], request_id: requestId, ...buildingInput } = input
    if (rooms.length > 0) requireCapability(user, 'rooms.create', 'Không có quyền tạo phòng')

    const owner = isOwner(user)
    // Building + owner assignment + rooms are created in one atomic RPC; the
    // owner is assigned inside the same transaction so there is no partial state.
    const result = await BuildingRepository.createWithRooms(event, buildingInput, rooms, {
      actorId: user.id,
      ownerUserId: owner ? user.id : null,
      requestId: requestId ?? randomUUID(),
    })
    // Invalidate the per-request scope cache so a follow-up read in the same
    // request includes the newly created building.
    event.context.__buildingScope = undefined

    if (!result.replayed) {
      const buildingId = result.building.id
      if (owner) {
        await AuditService.append(event, user, {
          building_id: buildingId,
          action: AUDIT_ACTIONS.USER_ASSIGNMENT_ADDED,
          entity_type: 'user',
          entity_id: user.id,
          metadata: { building_id: buildingId, self_assigned: true },
        })
      }
      await AuditService.append(event, user, {
        building_id: buildingId,
        action: AUDIT_ACTIONS.BUILDING_CREATED,
        entity_type: 'building',
        entity_id: buildingId,
        after_data: result.building,
        metadata: { room_count: result.rooms.length, request_id: requestId ?? null },
      })
      if (result.rooms.length > 0) {
        await AuditService.appendBulk(event, user, {
          building_id: buildingId,
          entity_type: 'room',
          aggregate_action: 'room.bulk_create',
          items: result.rooms.map(room => ({ entity_id: room.id, action: AUDIT_ACTIONS.ROOM_CREATED, after_data: room })),
          succeeded: result.rooms.map(room => room.id),
          total: result.rooms.length,
          failed: 0,
        })
      }
    }
    return { building: result.building, roomCount: result.rooms.length }
  },

  async update(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: BuildingUpdateInput,
  ): Promise<Building> {
    requireCapability(user, 'buildings.update', 'Không có quyền cập nhật tòa nhà')
    const existing = await BuildingRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, existing.id, 'write')
    const updated = await BuildingRepository.update(event, existing.id, input)
    await AuditService.append(event, user, {
      building_id: updated.id,
      action: AUDIT_ACTIONS.BUILDING_UPDATED,
      entity_type: 'building',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })
    return updated
  },

  async setVisibility(
    event: H3Event,
    user: AuthUser,
    id: string,
    input: BuildingVisibilityInput,
  ): Promise<Building> {
    // Hiding removes a building from every list and aggregate for every user, so
    // it is gated separately from `buildings.update`.
    requireCapability(user, 'buildings.visibility.manage', 'Không có quyền đổi hiển thị tòa nhà')
    const existing = await BuildingRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy tòa nhà')
    if (existing.isHidden === input.is_hidden) return existing

    const updated = await BuildingRepository.setVisibility(event, existing.id, input.is_hidden)
    event.context.__visibleBuildingScope = undefined
    event.context.__hiddenBuildingIds = undefined

    await AuditService.append(event, user, {
      building_id: updated.id,
      action: AUDIT_ACTIONS.BUILDING_VISIBILITY_CHANGED,
      entity_type: 'building',
      entity_id: updated.id,
      before_data: { is_hidden: existing.isHidden },
      after_data: { is_hidden: updated.isHidden },
    })
    return updated
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    id: string,
    opts: { force?: boolean; emitAudit?: boolean } = {},
  ): Promise<Building | undefined> {
    requireCapability(user, 'buildings.delete', 'Không có quyền xoá tòa nhà')
    const existing = await BuildingRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, existing.id, 'write')

    if (opts.force) {
      const archived = await BuildingRepository.softArchive(event, existing.id)
      if (opts.emitAudit !== false) await AuditService.append(event, user, {
        building_id: existing.id,
        action: AUDIT_ACTIONS.BUILDING_ARCHIVED,
        entity_type: 'building',
        entity_id: existing.id,
        before_data: existing,
        after_data: archived,
      })
      return archived
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

    if (opts.emitAudit === false) {
      await BuildingRepository.remove(event, existing.id)
    }
    else {
      await BuildingRepository.removeWithAudit(event, existing.id, user.id, randomUUID())
    }
    return undefined
  },

  async bulkAction(
    event: H3Event,
    user: AuthUser,
    input: BuildingBulkActionInput,
  ): Promise<BuildingBulkResult> {
    requireCapability(user, 'buildings.delete', 'Không có quyền thao tác hàng loạt')

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []
    const beforeSnapshots = await BulkActionRepository.resolveSnapshots(event, 'building', input.ids)

    for (const id of input.ids) {
      try {
        if (input.action === 'delete') {
          await BuildingService.remove(event, user, id, { emitAudit: false })
          succeeded.push(id)
          continue
        }

        const existing = await BuildingRepository.findByIdentifier(event, id)
        if (!existing) {
          failed.push({ id, reason: 'not_found' })
          continue
        }

        if (input.action === 'archive') {
          await assertBuildingScope(event, user, existing.id, 'write')
          await BuildingRepository.softArchive(event, existing.id)
        }
        else if (input.action === 'activate') {
          await assertBuildingScope(event, user, existing.id, 'write')
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

    const afterSnapshots = input.action === 'delete'
      ? new Map<string, Record<string, unknown>>()
      : await BulkActionRepository.resolveSnapshots(event, 'building', succeeded)
    await AuditService.appendBulk(event, user, {
      building_id: null,
      entity_type: 'building',
      aggregate_action: `building.bulk_${input.action}`,
      items: succeeded.map(id => ({
        entity_id: id,
        building_id: id,
        action: input.action === 'delete' ? AUDIT_ACTIONS.BUILDING_REMOVED : input.action === 'archive' ? AUDIT_ACTIONS.BUILDING_ARCHIVED : AUDIT_ACTIONS.BUILDING_ACTIVATED,
        before_data: beforeSnapshots.get(id),
        after_data: afterSnapshots.get(id),
      })),
      succeeded,
      total: input.ids.length,
      failed: failed.length,
    })

    return { succeeded, failed }
  },
}
