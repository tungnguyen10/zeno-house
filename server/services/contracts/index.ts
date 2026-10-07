import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractBulkActionInput, ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'
import { ContractRepository, type ContractFilters } from '../../repositories/contracts'
import { BulkActionRepository } from '../../repositories/bulk-actions'
import { ContractServiceService } from '../contract-services'
import { ContractOccupantRepository } from '../../repositories/contract-occupants'
import { RoomRepository } from '../../repositories/rooms'
import { BuildingRepository } from '../../repositories/buildings'
import { TenantRepository } from '../../repositories/tenants'
import { assertBuildingScope, canDeleteMasterData, getAssignedBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { ContractAmendmentRepository } from '../../repositories/contract-amendments'
import { ContractAmendmentService } from '../contract-amendments'

interface ContractDeleteConflictDetails {
  reason?: 'ACTIVE_CONTRACT'
  issuedBillingPeriods?: number
  paidPayments?: number
  nonHandoverMeterReadings?: number
  publishedAmendments?: number
}

export interface ContractBulkActionResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

function hasDeleteConflicts(details: ContractDeleteConflictDetails): boolean {
  return Boolean(
    details.reason
    || (details.issuedBillingPeriods && details.issuedBillingPeriods > 0)
    || (details.paidPayments && details.paidPayments > 0)
    || (details.nonHandoverMeterReadings && details.nonHandoverMeterReadings > 0)
    || (details.publishedAmendments && details.publishedAmendments > 0)
  )
}

function throwDeleteConflict(details: ContractDeleteConflictDetails): never {
  throw createError({
    statusCode: 409,
    data: {
      error: {
        code: 'CONFLICT',
        message: 'Hợp đồng còn ràng buộc, không thể xoá',
        details,
      },
    },
  })
}

function bulkFailureReason(err: unknown): string {
  const e = err as {
    data?: { error?: { code?: string; details?: ContractDeleteConflictDetails } }
    message?: string
  }
  const code = e?.data?.error?.code
  if (code === 'NOT_FOUND') return 'not_found'
  if (code !== 'CONFLICT') return e?.message ?? 'error'

  const details = e?.data?.error?.details
  if (details?.reason === 'ACTIVE_CONTRACT') return 'ACTIVE_CONTRACT'
  if (details?.issuedBillingPeriods && details.issuedBillingPeriods > 0) return 'has_billing_history'
  if (details?.paidPayments && details.paidPayments > 0) return 'has_paid_invoices'
  if (details?.nonHandoverMeterReadings && details.nonHandoverMeterReadings > 0) return 'has_meter_readings'
  return 'conflict'
}

export const ContractService = {
  async list(
    event: H3Event,
    user: AuthUser,
    filters: ContractFilters,
  ): Promise<{ items: ContractWithDetails[]; total: number }> {
    requireCapability(user, 'contracts.read', 'Không có quyền xem danh sách hợp đồng')

    let buildingId = filters.building_id
    const buildingIds = await getAssignedBuildingIds(event, user)
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Building not found')
      if (buildingIds && !buildingIds.includes(building.id)) {
        return { items: [], total: 0 }
      }
      buildingId = building.id
    }

    let roomId = filters.room_id
    if (roomId) {
      const room = await RoomRepository.findByIdentifier(event, roomId)
      if (!room) throwNotFound('Room not found')
      roomId = room.id
    }

    let tenantId = filters.tenant_id
    if (tenantId) {
      const tenant = await TenantRepository.findByIdentifier(event, tenantId)
      if (!tenant) throwNotFound('Tenant not found')
      tenantId = tenant.id
    }

    return ContractRepository.findAll(event, {
      ...filters,
      building_id: buildingId,
      buildingIds,
      room_id: roomId,
      tenant_id: tenantId,
    })
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<ContractWithDetails> {
    requireCapability(user, 'contracts.read', 'Không có quyền xem hợp đồng')
    const contract = await ContractRepository.findByIdentifier(event, id)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'read')
    return contract
  },

  async create(event: H3Event, user: AuthUser, input: ContractCreateInput): Promise<ContractWithDetails> {
    requireCapability(user, 'contracts.create', 'Không có quyền tạo hợp đồng')

    const room = await RoomRepository.findById(event, input.room_id)
    if (!room) throwNotFound('Không tìm thấy phòng')
    await assertBuildingScope(event, user, room.buildingId, 'write')
    if (room.status === 'maintenance') throwConflict(`Phòng "${room.roomNumber}" đang bảo trì, không thể tạo hợp đồng`)

    if (input.status === 'active' || !input.status) {
      const roomConflict = await ContractRepository.findActiveByRoomId(event, input.room_id)
      if (roomConflict) throwConflict('Phòng này đã có hợp đồng đang hiệu lực')

      const primaryConflict = await ContractRepository.findActiveByTenantId(event, input.tenant_id)
      if (primaryConflict) throwConflict('Khách thuê này đang đứng tên hợp đồng tại phòng khác')

      const occupantConflict = await ContractOccupantRepository.findActiveOccupancyByTenant(event, input.tenant_id)
      if (occupantConflict) throwConflict('Khách thuê này đang ở theo hợp đồng khác')
    }

    // Room là nguồn giá chuẩn — nếu input không gửi giá hợp lệ, lấy từ phòng.
    // Nếu cả 2 đều bằng 0, từ chối ngay tại tầng service để không tạo hợp đồng "miễn phí" do bug form.
    const resolvedRent = input.monthly_rent && input.monthly_rent > 0
      ? input.monthly_rent
      : room.monthlyRent
    if (!resolvedRent || resolvedRent <= 0) {
      throwConflict(`Phòng "${room.roomNumber}" chưa được đặt giá thuê. Vui lòng cập nhật giá phòng trước khi tạo hợp đồng.`)
    }

    const contract = await ContractRepository.createWithHandover(
      event,
      {
        ...input,
        monthly_rent: resolvedRent,
        building_id: input.building_id ?? room.buildingId,
      },
      user.id ?? null,
    )

    // Best-effort: clone active building_services → contract_services
    const buildingId = input.building_id ?? room.buildingId
    if (buildingId) {
      await ContractServiceService.cloneFromBuilding(event, contract.id, buildingId)
    }

    const correlationId = randomUUID()
    if (input.status === 'active' || !input.status) {
      const updatedRoom = await RoomRepository.update(event, input.room_id, { status: 'occupied' })
      await AuditService.append(event, user, {
        building_id: room.buildingId,
        action: AUDIT_ACTIONS.ROOM_UPDATED,
        entity_type: 'room',
        entity_id: room.id,
        correlation_id: correlationId,
        before_data: room,
        after_data: updatedRoom,
      })
    }

    await AuditService.append(event, user, {
      building_id: contract.buildingId,
      action: AUDIT_ACTIONS.CONTRACT_CREATED,
      entity_type: 'contract',
      entity_id: contract.id,
      correlation_id: correlationId,
      after_data: contract,
    })

    return contract
  },

  async update(event: H3Event, user: AuthUser, id: string, input: ContractUpdateInput): Promise<ContractWithDetails> {
    requireCapability(user, 'contracts.update', 'Không có quyền cập nhật hợp đồng')
    const existing = await ContractRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, existing.buildingId, 'write')

    const newStatus = input.status ?? existing.status
    const newRoomId = input.room_id ?? existing.roomId
    const newTenantId = input.tenant_id ?? existing.tenantId
    const wasActive = existing.status === 'active'
    const willBeActive = newStatus === 'active'
    if (wasActive && !willBeActive) {
      throwConflict('Hãy dùng Trả phòng để ghi nhận bàn giao trước khi kết thúc hợp đồng.', { reason: 'CHECKOUT_REQUIRED' })
    }
    const roomChanged = newRoomId !== existing.roomId
    const correlationId = randomUUID()
    if (roomChanged) {
      const newRoom = await RoomRepository.findById(event, newRoomId)
      if (!newRoom) throwNotFound('Không tìm thấy phòng')
      await assertBuildingScope(event, user, newRoom.buildingId, 'write')
    }

    if (willBeActive) {
      const conflict = await ContractRepository.findActiveByRoomId(event, newRoomId, existing.id)
      if (conflict) throwConflict('Phòng này đã có hợp đồng đang hiệu lực')

      const primaryConflict = await ContractRepository.findActiveByTenantId(event, newTenantId, existing.id)
      if (primaryConflict) throwConflict('Khách thuê này đang đứng tên hợp đồng tại phòng khác')

      const occupantConflict = await ContractOccupantRepository.findActiveOccupancyByTenant(event, newTenantId, existing.id)
      if (occupantConflict) throwConflict('Khách thuê này đang ở theo hợp đồng khác')
    }

    const updated = await ContractRepository.update(event, existing.id, input)

    // Release the previous room whenever the contract leaves it while having been active there:
    //   - active → expired/terminated (status transition)
    //   - active → active but moved to a different room
    if (wasActive && (!willBeActive || roomChanged)) {
      const oldRoom = await RoomRepository.findById(event, existing.roomId)
      if (oldRoom && oldRoom.status !== 'maintenance') {
        const releasedRoom = await RoomRepository.update(event, existing.roomId, { status: 'available' })
        await AuditService.append(event, user, {
          building_id: oldRoom.buildingId,
          action: AUDIT_ACTIONS.ROOM_UPDATED,
          entity_type: 'room',
          entity_id: oldRoom.id,
          correlation_id: correlationId,
          before_data: oldRoom,
          after_data: releasedRoom,
        })
      }
    }

    // Claim the (new) room whenever the contract becomes active for it:
    //   - expired/terminated → active (reactivation)
    //   - active → active but reassigned to a different room
    if (willBeActive && (!wasActive || roomChanged)) {
      const newRoom = await RoomRepository.findById(event, newRoomId)
      if (newRoom && newRoom.status !== 'maintenance') {
        const occupiedRoom = await RoomRepository.update(event, newRoomId, { status: 'occupied' })
        await AuditService.append(event, user, {
          building_id: newRoom.buildingId,
          action: AUDIT_ACTIONS.ROOM_UPDATED,
          entity_type: 'room',
          entity_id: newRoom.id,
          correlation_id: correlationId,
          before_data: newRoom,
          after_data: occupiedRoom,
        })
      }
    }

    const auditAction
      = updated.status === 'terminated' ? AUDIT_ACTIONS.CONTRACT_TERMINATED
      : updated.status === 'expired' ? AUDIT_ACTIONS.CONTRACT_EXPIRED
      : AUDIT_ACTIONS.CONTRACT_UPDATED
    await AuditService.append(event, user, {
      building_id: updated.buildingId,
      action: auditAction,
      entity_type: 'contract',
      entity_id: updated.id,
      correlation_id: correlationId,
      before_data: existing,
      after_data: updated,
    })

    if (existing.status === 'active' && updated.status === 'terminated') {
      await ContractAmendmentService.cancelScheduledForContract(
        event,
        user,
        updated.id,
        'Hợp đồng đã chấm dứt',
      )
    }

    return updated
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    id: string,
    opts: { force?: boolean; reason: string; emitAudit?: boolean },
  ): Promise<ContractWithDetails | undefined> {
    const existing = await ContractRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, existing.buildingId, 'write')
    if (!await canDeleteMasterData(event, user, existing.buildingId)) {
      throwForbidden('Không có quyền xoá hợp đồng trong tòa nhà này')
    }

    if (existing.status === 'active') throwDeleteConflict({ reason: 'ACTIVE_CONTRACT' })

    const [issuedBillingPeriods, paidPayments, nonHandoverMeterReadings, publishedAmendments] = await Promise.all([
      ContractRepository.countBillingPeriodsForContract(event, existing.id),
      ContractRepository.countPaidInvoicesForContract(event, existing.id),
      ContractRepository.countNonHandoverMeterReadingsForContract(event, existing.id),
      ContractAmendmentRepository.listPublishedByContract(event, existing.id),
    ])

    const details: ContractDeleteConflictDetails = {
      ...(issuedBillingPeriods > 0 ? { issuedBillingPeriods } : {}),
      ...(paidPayments > 0 ? { paidPayments } : {}),
      ...(nonHandoverMeterReadings > 0 ? { nonHandoverMeterReadings } : {}),
      ...(publishedAmendments.length > 0 ? { publishedAmendments: publishedAmendments.length } : {}),
    }

    if (hasDeleteConflicts(details)) throwDeleteConflict(details)

    await ContractRepository.removeWithCascade(event, existing)
    if (opts.emitAudit !== false) await AuditService.append(event, user, {
      building_id: existing.buildingId,
      action: AUDIT_ACTIONS.CONTRACT_REMOVED,
      entity_type: 'contract',
      entity_id: existing.id,
      before_data: existing,
      metadata: { reason: opts.reason },
    })
    return opts.force ? existing : undefined
  },

  async bulkAction(
    event: H3Event,
    user: AuthUser,
    input: ContractBulkActionInput,
  ): Promise<ContractBulkActionResult> {
    requireCapability(user, 'contracts.update', 'Không có quyền thao tác hàng loạt')

    if (input.action === 'terminate') {
      throwConflict('Mở từng hợp đồng trong danh sách cần xử lý để nhập ngày, lý do và chỉ số bàn giao.', { reason: 'CHECKOUT_REQUIRED' })
    }

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []
    const scopes = await BulkActionRepository.resolveBuildingScopes(event, 'contract', input.ids)
    const beforeSnapshots = await BulkActionRepository.resolveSnapshots(event, 'contract', input.ids)

    for (const id of input.ids) {
      try {
        await this.remove(event, user, id, { reason: input.reason!, emitAudit: false })
        succeeded.push(id)
      }
      catch (err: unknown) {
        failed.push({ id, reason: bulkFailureReason(err) })
      }
    }

    // Note: per-entity audit events are already emitted by update()/remove() above.
    // Emit aggregate summary for bulk operation visibility.
    const bulkAction = AUDIT_ACTIONS.CONTRACT_REMOVED
    await AuditService.appendBulk(event, user, {
      building_id: null,
      entity_type: 'contract',
      aggregate_action: `contract.bulk_${input.action}`,
      items: succeeded.map(id => ({ entity_id: id, building_id: scopes.get(id) ?? null, action: bulkAction, before_data: beforeSnapshots.get(id) })),
      succeeded,
      total: input.ids.length,
      failed: failed.length,
    })

    return { succeeded, failed }
  },
}
