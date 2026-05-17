import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractOccupant } from '~/types/contract-occupants'
import type { ContractOccupantAddInput, ContractOccupantMoveOutInput } from '~/utils/validators/contract-occupants'
import { ContractOccupantRepository } from '../repositories/contract-occupants'
import { ContractRepository } from '../repositories/contracts'

export const ContractOccupantService = {
  async list(event: H3Event, user: AuthUser, contractId: string): Promise<ContractOccupant[]> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem người ở hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    return ContractOccupantRepository.listByContract(event, contractId)
  },

  async add(event: H3Event, user: AuthUser, contractId: string, input: ContractOccupantAddInput): Promise<ContractOccupant> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền thêm người ở hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')

    // Block primary tenant
    if (input.tenant_id === contract.tenantId) throwConflict('Người thuê chính đã là đại diện hợp đồng, không thể thêm vào danh sách người ở')

    // Block if already primary tenant on another active contract
    const activePrimaryContract = await ContractRepository.findActiveByTenantId(event, input.tenant_id)
    if (activePrimaryContract) throwConflict('Khách thuê này đang đứng tên hợp đồng tại phòng khác')

    // Block if already active occupant in another contract (also covered by DB unique index)
    const activeOccupancy = await ContractOccupantRepository.findActiveOccupancyByTenant(event, input.tenant_id, contractId)
    if (activeOccupancy) throwConflict('Khách thuê này đang ở tại hợp đồng khác')

    // Block duplicate within same contract
    const existing = await ContractOccupantRepository.findActiveByTenant(event, contractId, input.tenant_id)
    if (existing) throwConflict('Khách thuê này đã có trong danh sách người ở của hợp đồng này')

    return ContractOccupantRepository.insert(event, contractId, input)
  },

  async moveOut(event: H3Event, user: AuthUser, contractId: string, occupantId: string, input: ContractOccupantMoveOutInput): Promise<ContractOccupant> {
    if (!can(user, 'contracts.delete')) throwForbidden('Chỉ admin mới được ghi nhận rời phòng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    const occupant = await ContractOccupantRepository.findById(event, occupantId)
    if (!occupant || occupant.contractId !== contractId) throwNotFound('Không tìm thấy người ở')
    return ContractOccupantRepository.updateById(event, occupantId, input)
  },

  async remove(event: H3Event, user: AuthUser, contractId: string, occupantId: string): Promise<void> {
    if (!can(user, 'contracts.delete')) throwForbidden('Chỉ admin mới được xoá người ở')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    const occupant = await ContractOccupantRepository.findById(event, occupantId)
    if (!occupant || occupant.contractId !== contractId) throwNotFound('Không tìm thấy người ở')
    return ContractOccupantRepository.deleteById(event, occupantId)
  },
}
