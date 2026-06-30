import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Tenant } from '~/types/tenants'
import type {
  TenantBulkActionInput,
  TenantCreateInput,
  TenantUpdateInput,
} from '~/utils/validators/tenants'
import { TenantRepository, type TenantFilters } from '../../repositories/tenants'
import { BuildingRepository } from '../../repositories/buildings'
import { canDeleteMasterData, getAssignedBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

export interface TenantBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export const TenantService = {
  async list(
    event: H3Event,
    user: AuthUser,
    filters: TenantFilters,
  ): Promise<{ items: Tenant[]; total: number }> {
    if (!can(user, 'tenants.read')) throwForbidden('Không có quyền xem danh sách khách thuê')
    let buildingId = filters.building_id
    const buildingIds = await getAssignedBuildingIds(event, user)
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      if (buildingIds && !buildingIds.includes(building.id)) {
        return { items: [], total: 0 }
      }
      buildingId = building.id
    }
    return TenantRepository.findAll(event, { ...filters, building_id: buildingId, buildingIds })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Tenant> {
    if (!can(user, 'tenants.read')) throwForbidden('Không có quyền xem khách thuê')
    const tenant = await TenantRepository.findByIdentifier(event, id)
    if (!tenant) throwNotFound('Không tìm thấy khách thuê')
    const buildingIds = await getAssignedBuildingIds(event, user)
    if (buildingIds && !await TenantRepository.hasContractInBuildings(event, tenant.id, buildingIds)) {
      throwNotFound('Không tìm thấy khách thuê')
    }
    return tenant
  },

  async create(event: H3Event, user: AuthUser, input: TenantCreateInput): Promise<Tenant> {
    if (!can(user, 'tenants.create')) throwForbidden('Không có quyền tạo khách thuê')
    if (input.id_number) {
      const existing = await TenantRepository.findByIdNumber(event, input.id_number)
      if (existing) throwConflict('Số CMND/CCCD đã tồn tại')
    }
    const result = await TenantRepository.insert(event, input)
    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_CREATED,
      entity_type: 'tenant',
      entity_id: result.id,
      after_data: result,
    })
    return result
  },

  async update(event: H3Event, user: AuthUser, id: string, input: TenantUpdateInput): Promise<Tenant> {
    if (!can(user, 'tenants.update')) throwForbidden('Không có quyền cập nhật khách thuê')
    const existing = await TenantRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy khách thuê')
    if (input.id_number) {
      const conflict = await TenantRepository.findByIdNumber(event, input.id_number, existing.id)
      if (conflict) throwConflict('Số CMND/CCCD đã tồn tại')
    }
    const updated = await TenantRepository.update(event, existing.id, input)
    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_UPDATED,
      entity_type: 'tenant',
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
    opts: { force?: boolean; reason: string; buildingId?: string } = { reason: '' },
  ): Promise<Tenant | undefined> {
    const existing = await TenantRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy khách thuê')
    const scopeBuildingId = await TenantRepository.findActiveBuildingIdForTenant(event, existing.id)
      ?? opts.buildingId
    if (!scopeBuildingId && user.app_metadata.role !== 'admin') {
      throwForbidden('Không xác định được tòa nhà để kiểm tra quyền xoá khách thuê')
    }
    if (scopeBuildingId && !await canDeleteMasterData(event, user, scopeBuildingId)) {
      throwForbidden('Không có quyền xoá khách thuê trong tòa nhà này')
    }

    if (opts.force) {
      const archived = await TenantRepository.softArchive(event, existing.id)
      await AuditService.append(event, user, {
        building_id: scopeBuildingId ?? null,
        action: AUDIT_ACTIONS.TENANT_ARCHIVED,
        entity_type: 'tenant',
        entity_id: existing.id,
        before_data: existing,
        after_data: archived,
        metadata: { reason: opts.reason },
      })
      return archived
    }

    const [activeContracts, activeOccupancies] = await Promise.all([
      TenantRepository.countActiveContractsForTenant(event, existing.id),
      TenantRepository.countActiveOccupanciesForTenant(event, existing.id),
    ])

    if (activeContracts > 0 || activeOccupancies > 0) {
      throw createError({
        statusCode: 409,
        data: {
          error: {
            code: 'CONFLICT',
            message: 'Khách thuê còn ràng buộc, không thể xoá',
            details: { activeContracts, activeOccupancies },
          },
        },
      })
    }

    await TenantRepository.remove(event, existing.id)
    await AuditService.append(event, user, {
      building_id: scopeBuildingId ?? null,
      action: AUDIT_ACTIONS.TENANT_REMOVED,
      entity_type: 'tenant',
      entity_id: existing.id,
      before_data: existing,
      metadata: { reason: opts.reason },
    })
    return undefined
  },

  async bulkAction(
    event: H3Event,
    user: AuthUser,
    input: TenantBulkActionInput,
  ): Promise<TenantBulkResult> {
    if (!can(user, 'tenants.update')) throwForbidden('Không có quyền thao tác hàng loạt')

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []

    for (const id of input.ids) {
      try {
        if (input.action === 'delete') {
          await TenantService.remove(event, user, id, {
            reason: input.reason!,
            buildingId: input.building_id,
          })
          succeeded.push(id)
          continue
        }

        const existing = await TenantRepository.findByIdentifier(event, id)
        if (!existing) {
          failed.push({ id, reason: 'not_found' })
          continue
        }

        if (input.action === 'archive') {
          await TenantRepository.setStatus(event, existing.id, 'archived')
        }
        else if (input.action === 'activate') {
          await TenantRepository.setStatus(event, existing.id, 'active')
        }
        succeeded.push(id)
      }
      catch (err: unknown) {
        const e = err as { data?: { error?: { code?: string; details?: { activeContracts?: number; activeOccupancies?: number } } }; message?: string }
        const code = e?.data?.error?.code
        if (code === 'CONFLICT') {
          const details = e?.data?.error?.details
          if (details?.activeContracts && details.activeContracts > 0) failed.push({ id, reason: 'has_active_contracts' })
          else if (details?.activeOccupancies && details.activeOccupancies > 0) failed.push({ id, reason: 'has_active_occupancies' })
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

    const bulkActionCode = input.action === 'archive' ? AUDIT_ACTIONS.TENANT_ARCHIVED : AUDIT_ACTIONS.TENANT_REMOVED
    await AuditService.appendBulk(event, user, {
      building_id: null,
      entity_type: 'tenant',
      aggregate_action: `tenant.bulk_${input.action}`,
      items: succeeded.map(id => ({ entity_id: id, action: bulkActionCode })),
      succeeded,
      total: input.ids.length,
      failed: failed.length,
    })

    return { succeeded, failed }
  },
}
