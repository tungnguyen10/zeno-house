import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import { ContractServiceRepository } from '../../repositories/contract-services'
import { BuildingRepository } from '../../repositories/buildings'
import { ContractRepository } from '../../repositories/contracts'
import { assertBuildingScope } from '../../utils/scope'

export const ContractServiceService = {
  async list(event: H3Event, _user: AuthUser, contractId: string): Promise<ContractService[]> {
    if (!can(_user, 'contract-services.read')) throwForbidden('Không có quyền xem dịch vụ hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, _user, contract.buildingId, 'read')
    return ContractServiceRepository.findByContract(event, contract.id)
  },

  async listByBuilding(event: H3Event, _user: AuthUser, buildingId: string): Promise<ContractService[]> {
    if (!can(_user, 'contract-services.read')) throwForbidden('Không có quyền xem dịch vụ hợp đồng')
    const building = await BuildingRepository.findByIdentifier(event, buildingId)
    if (!building) throwNotFound('Building not found')
    await assertBuildingScope(event, _user, building.id, 'read')
    return ContractServiceRepository.findByBuilding(event, building.id)
  },

  async update(event: H3Event, _user: AuthUser, id: string, input: ContractServiceUpdateInput): Promise<ContractService> {
    if (!can(_user, 'contract-services.write')) throwForbidden('Không có quyền cập nhật dịch vụ hợp đồng')
    const existing = await ContractServiceRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy dịch vụ hợp đồng')
    const contract = await ContractRepository.findById(event, existing.contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, _user, contract.buildingId, 'write')
    return ContractServiceRepository.update(event, id, input)
  },

  async syncFromBuilding(event: H3Event, _user: AuthUser, buildingId: string): Promise<number> {
    if (!can(_user, 'contract-services.write')) throwForbidden('Không có quyền đồng bộ dịch vụ')
    const building = await BuildingRepository.findByIdentifier(event, buildingId)
    if (!building) throwNotFound('Building not found')
    await assertBuildingScope(event, _user, building.id, 'write')
    return ContractServiceRepository.syncFromBuilding(event, building.id)
  },

  async cloneFromBuilding(event: H3Event, contractId: string, buildingId: string): Promise<void> {
    return ContractServiceRepository.cloneFromBuilding(event, contractId, buildingId)
  },
}
