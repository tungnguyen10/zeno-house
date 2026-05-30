import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import { ContractServiceRepository } from '../../repositories/contract-services'

export const ContractServiceService = {
  async list(event: H3Event, _user: AuthUser, contractId: string): Promise<ContractService[]> {
    if (!can(_user, 'contract-services.read')) throwForbidden('Không có quyền xem dịch vụ hợp đồng')
    return ContractServiceRepository.findByContract(event, contractId)
  },

  async listByBuilding(event: H3Event, _user: AuthUser, buildingId: string): Promise<ContractService[]> {
    if (!can(_user, 'contract-services.read')) throwForbidden('Không có quyền xem dịch vụ hợp đồng')
    return ContractServiceRepository.findByBuilding(event, buildingId)
  },

  async update(event: H3Event, _user: AuthUser, id: string, input: ContractServiceUpdateInput): Promise<ContractService> {
    if (!can(_user, 'contract-services.write')) throwForbidden('Không có quyền cập nhật dịch vụ hợp đồng')
    return ContractServiceRepository.update(event, id, input)
  },

  async syncFromBuilding(event: H3Event, _user: AuthUser, buildingId: string): Promise<number> {
    if (!can(_user, 'contract-services.write')) throwForbidden('Không có quyền đồng bộ dịch vụ')
    return ContractServiceRepository.syncFromBuilding(event, buildingId)
  },

  async cloneFromBuilding(event: H3Event, contractId: string, buildingId: string): Promise<void> {
    return ContractServiceRepository.cloneFromBuilding(event, contractId, buildingId)
  },
}
