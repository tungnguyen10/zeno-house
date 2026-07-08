import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { Tenant } from '~/types/tenants'
import type {
  TenantBulkActionInput,
  TenantBulkCreateInput,
  TenantBulkCreateRowInput,
  TenantCreateInput,
  TenantIdImageSideInput,
  TenantUpdateInput,
} from '~/utils/validators/tenants'
import { tenantCreateSchema } from '~/utils/validators/tenants'
import { TenantRepository, type TenantFilters } from '../../repositories/tenants'
import { BuildingRepository } from '../../repositories/buildings'
import { canDeleteMasterData, getAssignedBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { db } from '../../utils/db'
import { throwValidationError } from '../../utils/errors'

const TENANT_ID_IMAGE_BUCKET = 'tenant-id-images'
const MAX_TENANT_ID_IMAGE_BYTES = 5 * 1024 * 1024
const TENANT_ID_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function signedTenantIdImageUrl(event: H3Event, path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await db(event)
    .storage
    .from(TENANT_ID_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 5)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data.signedUrl
}

async function withSignedTenantIdImages(event: H3Event, tenant: Tenant): Promise<Tenant> {
  const [idCardFrontSignedUrl, idCardBackSignedUrl] = await Promise.all([
    signedTenantIdImageUrl(event, tenant.idCardFrontPath),
    signedTenantIdImageUrl(event, tenant.idCardBackPath),
  ])

  return {
    ...tenant,
    idCardFrontSignedUrl,
    idCardBackSignedUrl,
  }
}

export interface TenantBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export interface TenantBulkCreateFailure {
  line: number
  reason: 'validation_error' | 'duplicate_in_file' | 'duplicate_id_number' | 'unexpected_error'
  message: string
  fieldErrors?: Record<string, string[]>
}

export interface TenantBulkCreateResult {
  created: Tenant[]
  failed: TenantBulkCreateFailure[]
}

function normalizeBulkCreateRow(row: TenantBulkCreateRowInput): TenantCreateInput {
  const trimOrNull = (v: string | null | undefined): string | null => {
    if (v === null || v === undefined) return null
    const t = v.trim()
    return t === '' ? null : t
  }

  const genderRaw = trimOrNull(row.gender)
  const gender = genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other'
    ? genderRaw
    : null

  return {
    full_name: trimOrNull(row.full_name) ?? '',
    phone: trimOrNull(row.phone) ?? '',
    email: trimOrNull(row.email),
    id_number: trimOrNull(row.id_number),
    date_of_birth: trimOrNull(row.date_of_birth),
    permanent_address: trimOrNull(row.permanent_address),
    notes: trimOrNull(row.notes),
    gender,
    occupation: trimOrNull(row.occupation),
    id_issued_date: trimOrNull(row.id_issued_date),
    id_issued_place: trimOrNull(row.id_issued_place),
    emergency_contact_name: trimOrNull(row.emergency_contact_name),
    emergency_contact_phone: trimOrNull(row.emergency_contact_phone),
  }
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

    let includeIds: string[] | undefined
    if (user.app_metadata.role === 'owner' && buildingIds && !buildingId) {
      includeIds = await TenantRepository.findCreatedTenantIdsByActor(event, user.id)
    }

    return TenantRepository.findAll(event, {
      ...filters,
      building_id: buildingId,
      buildingIds,
      include_ids: includeIds,
    })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Tenant> {
    if (!can(user, 'tenants.read')) throwForbidden('Không có quyền xem khách thuê')
    const tenant = await TenantRepository.findByIdentifier(event, id)
    if (!tenant) throwNotFound('Không tìm thấy khách thuê')
    const buildingIds = await getAssignedBuildingIds(event, user)
    if (buildingIds) {
      const inScopeByContract = await TenantRepository.hasContractInBuildings(event, tenant.id, buildingIds)
      if (!inScopeByContract) {
        const isOwnerCreatedOrphan = user.app_metadata.role === 'owner'
          && await TenantRepository.wasCreatedByActor(event, tenant.id, user.id)
        if (!isOwnerCreatedOrphan) {
          throwNotFound('Không tìm thấy khách thuê')
        }
      }
    }
    const activeAssignment = await TenantRepository.findActiveAssignmentByTenantId(event, tenant.id)
    const signedTenant = await withSignedTenantIdImages(event, tenant)
    return {
      ...signedTenant,
      hasActiveContract: Boolean(activeAssignment),
      activeAssignment,
    }
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
    return withSignedTenantIdImages(event, result)
  },

  async bulkCreate(
    event: H3Event,
    user: AuthUser,
    input: TenantBulkCreateInput,
  ): Promise<TenantBulkCreateResult> {
    if (!can(user, 'tenants.create')) throwForbidden('Không có quyền tạo khách thuê')

    const created: Tenant[] = []
    const failed: TenantBulkCreateFailure[] = []
    const seenIdNumbers = new Set<string>()

    for (const row of input.rows) {
      try {
        const normalized = normalizeBulkCreateRow(row)
        const parsed = tenantCreateSchema.safeParse(normalized)
        if (!parsed.success) {
          failed.push({
            line: row.line,
            reason: 'validation_error',
            message: 'Dữ liệu dòng không hợp lệ',
            fieldErrors: parsed.error.flatten().fieldErrors,
          })
          continue
        }

        if (parsed.data.id_number) {
          if (seenIdNumbers.has(parsed.data.id_number)) {
            failed.push({
              line: row.line,
              reason: 'duplicate_in_file',
              message: 'Số CMND/CCCD bị trùng trong file nhập',
              fieldErrors: { id_number: ['Số CMND/CCCD bị trùng trong file nhập'] },
            })
            continue
          }
          seenIdNumbers.add(parsed.data.id_number)

          const existing = await TenantRepository.findByIdNumber(event, parsed.data.id_number)
          if (existing) {
            failed.push({
              line: row.line,
              reason: 'duplicate_id_number',
              message: 'Số CMND/CCCD đã tồn tại trong hệ thống',
              fieldErrors: { id_number: ['Số CMND/CCCD đã tồn tại trong hệ thống'] },
            })
            continue
          }
        }

        const inserted = await TenantRepository.insert(event, parsed.data)
        await AuditService.append(event, user, {
          building_id: null,
          action: AUDIT_ACTIONS.TENANT_CREATED,
          entity_type: 'tenant',
          entity_id: inserted.id,
          after_data: inserted,
          metadata: { source: 'bulk_import', line: row.line },
        })

        created.push(await withSignedTenantIdImages(event, inserted))
      }
      catch {
        failed.push({
          line: row.line,
          reason: 'unexpected_error',
          message: 'Không thể tạo khách thuê ở dòng này',
        })
      }
    }

    if (created.length > 0) {
      await AuditService.appendBulk(event, user, {
        building_id: null,
        entity_type: 'tenant',
        aggregate_action: 'tenant.bulk_create',
        items: created.map(tenant => ({ entity_id: tenant.id, action: AUDIT_ACTIONS.TENANT_CREATED })),
        succeeded: created.map(tenant => tenant.id),
        total: input.rows.length,
        failed: failed.length,
      })
    }

    return { created, failed }
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
    return withSignedTenantIdImages(event, updated)
  },

  async uploadIdImage(
    event: H3Event,
    user: AuthUser,
    id: string,
    side: TenantIdImageSideInput,
    file: { filename?: string, type?: string, data: Buffer },
  ): Promise<Tenant> {
    if (!can(user, 'tenants.update')) throwForbidden('Không có quyền cập nhật khách thuê')

    const existing = await TenantRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy khách thuê')

    const contentType = file.type ?? ''
    const ext = TENANT_ID_IMAGE_EXTENSIONS[contentType]
    if (!ext) throwValidationError('Ảnh CCCD phải là jpeg, png hoặc webp')
    if (file.data.length > MAX_TENANT_ID_IMAGE_BYTES) {
      throwValidationError('Ảnh CCCD không được vượt quá 5MB')
    }

    const path = `${existing.id}/${side}/${randomUUID()}.${ext}`
    const storage = db(event).storage.from(TENANT_ID_IMAGE_BUCKET)
    const { error: uploadError } = await storage.upload(path, file.data, {
      contentType,
      upsert: false,
    })
    if (uploadError) throw createError({ statusCode: 500, message: uploadError.message })

    const updated = await TenantRepository.updateIdImagePath(event, existing.id, side, path)
    const previousPath = side === 'front' ? existing.idCardFrontPath : existing.idCardBackPath
    if (previousPath) await storage.remove([previousPath])

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_UPDATED,
      entity_type: 'tenant',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return withSignedTenantIdImages(event, updated)
  },

  async removeIdImage(
    event: H3Event,
    user: AuthUser,
    id: string,
    side: TenantIdImageSideInput,
  ): Promise<Tenant> {
    if (!can(user, 'tenants.update')) throwForbidden('Không có quyền cập nhật khách thuê')

    const existing = await TenantRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy khách thuê')

    const previousPath = side === 'front' ? existing.idCardFrontPath : existing.idCardBackPath
    const updated = await TenantRepository.updateIdImagePath(event, existing.id, side, null)
    if (previousPath) {
      await db(event).storage.from(TENANT_ID_IMAGE_BUCKET).remove([previousPath])
    }

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_UPDATED,
      entity_type: 'tenant',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
    })

    return withSignedTenantIdImages(event, updated)
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
