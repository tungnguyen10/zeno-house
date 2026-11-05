import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractRenewal } from '~/types/contract-renewals'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'
import { ContractRenewalRepository } from '../repositories/contract-renewals'
import { ContractRepository } from '../repositories/contracts'
import { assertBuildingScope } from '../utils/scope'

export const ContractRenewalService = {
  async list(event: H3Event, user: AuthUser, contractId: string): Promise<ContractRenewal[]> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem lịch sử gia hạn')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'read')
    return ContractRenewalRepository.listByContract(event, contract.id)
  },

  async renew(event: H3Event, user: AuthUser, contractId: string, input: ContractRenewInput): Promise<ContractRenewal> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền gia hạn hợp đồng')

    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')
    const result = await ContractRenewalRepository.renewAtomic(event, {
      contractId: contract.id,
      mode: input.mode,
      newEndDate: input.new_end_date,
      newMonthlyRent: input.new_monthly_rent ?? null,
      reason: input.reason ?? null,
      actorId: user.id,
      operationId: input.operation_id ?? randomUUID(),
      correlationId: randomUUID(),
    })
    return result.renewal
  },
}
