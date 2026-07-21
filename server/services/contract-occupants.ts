import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractOccupant } from '~/types/contract-occupants'
import type { ContractOccupantAddInput, ContractOccupantMoveOutInput } from '~/utils/validators/contract-occupants'
import { ContractOccupantRepository } from '../repositories/contract-occupants'
import { ContractRepository } from '../repositories/contracts'
import { assertBuildingScope } from '../utils/scope'
import { AuditService } from './audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

export const ContractOccupantService = {
  async list(event: H3Event, user: AuthUser, contractId: string): Promise<ContractOccupant[]> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem người ở hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'read')
    return ContractOccupantRepository.listByContract(event, contract.id)
  },

  async add(event: H3Event, user: AuthUser, contractId: string, input: ContractOccupantAddInput): Promise<ContractOccupant> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền thêm người ở hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')

    // Block primary tenant
    if (input.tenant_id === contract.tenantId) throwConflict('Người thuê chính đã là đại diện hợp đồng, không thể thêm vào danh sách người ở')

    // Block if already primary tenant on another active contract
    const activePrimaryContract = await ContractRepository.findActiveByTenantId(event, input.tenant_id)
    if (activePrimaryContract) throwConflict('Khách thuê này đang đứng tên hợp đồng tại phòng khác')

    // Block if already active occupant in another contract (also covered by DB unique index)
    const activeOccupancy = await ContractOccupantRepository.findActiveOccupancyByTenant(event, input.tenant_id, contract.id)
    if (activeOccupancy) throwConflict('Khách thuê này đang ở tại hợp đồng khác')

    // Block duplicate within same contract
    const existing = await ContractOccupantRepository.findActiveByTenant(event, contract.id, input.tenant_id)
    if (existing) throwConflict('Khách thuê này đã có trong danh sách người ở của hợp đồng này')

    // Block exceeding occupant_count limit (count = primary tenant + active roommates)
    if (input.role !== 'primary') {
      const all = await ContractOccupantRepository.listByContract(event, contract.id)
      const activeRoommates = all.filter(o => !o.moveOutDate && o.role === 'roommate').length
      const currentTotal = activeRoommates + 1 // +1 for primary tenant
      if (currentTotal + 1 > contract.occupantCount) {
        throwConflict(`Hợp đồng chỉ cho phép tối đa ${contract.occupantCount} người ở. Cập nhật hợp đồng nếu muốn tăng số người.`)
      }
    }

    const created = await ContractOccupantRepository.insert(event, contract.id, input)
    await AuditService.append(event, user, {
      building_id: contract.buildingId,
      action: AUDIT_ACTIONS.CONTRACT_OCCUPANT_ADDED,
      entity_type: 'contract_occupant',
      entity_id: created.id,
      after_data: created,
      metadata: { contract_id: contract.id },
    })
    return created
  },

  async moveOut(event: H3Event, user: AuthUser, contractId: string, occupantId: string, input: ContractOccupantMoveOutInput): Promise<ContractOccupant> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền ghi nhận rời phòng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')
    const occupant = await ContractOccupantRepository.findById(event, occupantId)
    if (!occupant || occupant.contractId !== contract.id) throwNotFound('Không tìm thấy người ở')
    const updated = await ContractOccupantRepository.updateById(event, occupantId, input)
    await AuditService.append(event, user, {
      building_id: contract.buildingId,
      action: AUDIT_ACTIONS.CONTRACT_OCCUPANT_MOVED_OUT,
      entity_type: 'contract_occupant',
      entity_id: occupant.id,
      before_data: occupant,
      after_data: updated,
      metadata: { contract_id: contract.id },
    })
    return updated
  },

  async remove(event: H3Event, user: AuthUser, contractId: string, occupantId: string): Promise<void> {
    if (!can(user, 'contracts.delete')) throwForbidden('Chỉ chủ nhà hoặc admin mới được xoá người ở')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')
    const occupant = await ContractOccupantRepository.findById(event, occupantId)
    if (!occupant || occupant.contractId !== contract.id) throwNotFound('Không tìm thấy người ở')
    await ContractOccupantRepository.deleteById(event, occupantId)
    await AuditService.append(event, user, {
      building_id: contract.buildingId,
      action: AUDIT_ACTIONS.CONTRACT_OCCUPANT_REMOVED,
      entity_type: 'contract_occupant',
      entity_id: occupant.id,
      before_data: occupant,
      metadata: { contract_id: contract.id },
    })
  },
}
