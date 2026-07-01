import { z } from 'zod'
import { AuditRepository } from '../../repositories/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { enrichAuditEvents } from '../../services/audit-enrichment'
import type { AuditEntityType } from '~/utils/constants/audit'

const querySchema = z.object({
  building_id: z.string().trim().min(1).optional(),
  entity_type: z.enum([
    'building',
    'room',
    'tenant',
    'contract',
    'contract_renewal',
    'building_service',
    'contract_service',
    'meter_device',
  ]).optional(),
  entity_id: z.string().trim().min(1).optional(),
  correlation_id: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rawQuery = getQuery(event)
  const result = querySchema.safeParse(rawQuery)
  if (!result.success) {
    throwValidationError('Tham số truy vấn không hợp lệ', result.error.flatten())
  }

  const { building_id, entity_type, entity_id, correlation_id, limit } = result.data

  // Manager must always provide building_id (cannot see global/tenant-only events)
  if (!can(user, 'buildings.read') || (user.role === 'manager' && !building_id)) {
    if (!building_id) {
      throwValidationError('building_id là bắt buộc với manager', {
        fieldErrors: { building_id: ['Bắt buộc'] },
        formErrors: [],
      })
    }
  }

  const opts = {
    limit,
    entityType: entity_type as AuditEntityType | undefined,
    entityId: entity_id,
    correlationId: correlation_id,
  }

  if (building_id) {
    // Resolve and scope-check the building
    const building = await BuildingRepository.findByIdentifier(event, building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    // Manager scope check
    if (user.role === 'manager') {
      const { assertBuildingScope } = await import('../../utils/scope')
      await assertBuildingScope(event, user, building.id, 'read')
    }

    const { items, total } = await AuditRepository.listByBuilding(event, building.id, opts)
    const enriched = await enrichAuditEvents(event, items)
    return { data: enriched, meta: { total } }
  }

  // Admin only: query across all buildings (including tenant events with NULL building_id)
  if (!can(user, 'buildings.delete')) throwForbidden('Không có quyền xem nhật ký toàn hệ thống')

  const { items, total } = await AuditRepository.listAll(event, opts)
  const enriched = await enrichAuditEvents(event, items)
  return { data: enriched, meta: { total } }
})
