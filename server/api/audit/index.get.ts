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
    'user',
  ]).optional(),
  entity_id: z.string().trim().min(1).optional(),
  correlation_id: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { building_id, entity_type, entity_id, correlation_id, limit } = parseQuery(event, querySchema)

  if (!can(user, 'buildings.read')) {
    throwForbidden('Không có quyền xem nhật ký')
  }

  // Owner and manager are scoped: they must always target a specific building.
  const scoped = isScopedRole(user)
  if (scoped && !building_id) {
    throwValidationError('building_id là bắt buộc với vai trò giới hạn theo tòa nhà', {
      fieldErrors: { building_id: ['Bắt buộc'] },
      formErrors: [],
    })
  }

  const opts = {
    limit,
    entityType: entity_type as AuditEntityType | undefined,
    entityId: entity_id,
    correlationId: correlation_id,
  }

  if (building_id) {
    // Resolve and scope-check the building. Scoped roles get 404 for out-of-scope
    // buildings (read semantics); admin is unscoped.
    const building = await BuildingRepository.findByIdentifier(event, building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    if (scoped) {
      const { assertBuildingScope } = await import('../../utils/scope')
      await assertBuildingScope(event, user, building.id, 'read')
    }

    const { items, total } = await AuditRepository.listByBuilding(event, building.id, opts)
    const enriched = await enrichAuditEvents(event, items)
    return { data: enriched, meta: { total } }
  }

  // Global query (admin only): includes tenant events with NULL building_id.
  if (!can(user, 'buildings.delete')) throwForbidden('Không có quyền xem nhật ký toàn hệ thống')

  const { items, total } = await AuditRepository.listAll(event, opts)
  const enriched = await enrichAuditEvents(event, items)
  return { data: enriched, meta: { total } }
})
