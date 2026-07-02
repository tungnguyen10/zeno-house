import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Building } from '~/types/buildings'
import type {
  BuildingBulkActionInput,
  BuildingCreateInput,
  BuildingUpdateInput,
} from '~/utils/validators/buildings'
import { BuildingRepository } from '../../repositories/buildings'
import { AssignmentRepository } from '../../repositories/assignments'
import { assertBuildingScope, getAssignedBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

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

    const owner = isOwner(user)
    // Owner-created buildings record owner provenance; admin-created buildings
    // record the creator only and stay globally visible (no owner scope).
    const result = await BuildingRepository.insert(event, input, {
      created_by: user.id,
      owner_user_id: owner ? user.id : null,
    })

    if (owner) {
      // Auto-assign the new building to the owner in the same workflow so the
      // owner immediately has scoped access. If the assignment fails, roll back
      // the building to avoid a partially inaccessible record.
      try {
        await AssignmentRepository.insert(event, {
          user_id: user.id,
          building_id: result.id,
          created_by: user.id,
        })
      }
      catch (err) {
        await BuildingRepository.remove(event, result.id).catch(() => {})
        throw err
      }
      // Invalidate the per-request scope cache so a follow-up read in the same
      // request includes the newly created building.
      event.context.__buildingScope = undefined

      await AuditService.append(event, user, {
        building_id: result.id,
        action: AUDIT_ACTIONS.USER_ASSIGNMENT_ADDED,
        entity_type: 'user',
        entity_id: user.id,
        metadata: { building_id: result.id, self_assigned: true },
      })
    }

    await AuditService.append(event, user, {
      building_id: result.id,
      action: AUDIT_ACTIONS.BUILDING_CREATED,
      entity_type: 'building',
      entity_id: result.id,
      after_data: result,
    })
    return result
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
      const archived = await BuildingRepository.softArchive(event, existing.id)
      await AuditService.append(event, user, {
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

    await BuildingRepository.remove(event, existing.id)
    await AuditService.append(event, user, {
      building_id: existing.id,
      action: AUDIT_ACTIONS.BUILDING_REMOVED,
      entity_type: 'building',
      entity_id: existing.id,
      before_data: existing,
    })
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

    await AuditService.appendBulk(event, user, {
      building_id: null,
      entity_type: 'building',
      aggregate_action: `building.bulk_${input.action}`,
      items: succeeded.map(id => ({
        entity_id: id,
        building_id: id,
        action: input.action === 'archive' ? AUDIT_ACTIONS.BUILDING_ARCHIVED : AUDIT_ACTIONS.BUILDING_ACTIVATED,
      })),
      succeeded,
      total: input.ids.length,
      failed: failed.length,
    })

    return { succeeded, failed }
  },
}
