import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractPayment } from '~/types/contract-payments'
import type { ContractPaymentCreateInput, ContractPaymentUpdateInput } from '~/utils/validators/contract-payments'
import { ContractPaymentRepository } from '../repositories/contract-payments'
import { ContractRepository } from '../repositories/contracts'
import { assertBuildingScope } from '../utils/scope'

export const ContractPaymentService = {
  async list(event: H3Event, user: AuthUser, contractId: string): Promise<ContractPayment[]> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem thanh toán hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'read')
    return ContractPaymentRepository.listByContract(event, contract.id)
  },

  async create(event: H3Event, user: AuthUser, contractId: string, input: ContractPaymentCreateInput): Promise<ContractPayment> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền thêm thanh toán hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')
    return ContractPaymentRepository.insert(event, contract.id, input)
  },

  async update(event: H3Event, user: AuthUser, contractId: string, paymentId: string, input: ContractPaymentUpdateInput): Promise<ContractPayment> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền sửa thanh toán hợp đồng')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')
    const payment = await ContractPaymentRepository.findById(event, paymentId)
    if (!payment || payment.contractId !== contract.id) throwNotFound('Không tìm thấy thanh toán')
    return ContractPaymentRepository.updateById(event, paymentId, input)
  },

  async remove(event: H3Event, user: AuthUser, contractId: string, paymentId: string): Promise<void> {
    if (!can(user, 'contracts.delete')) throwForbidden('Chỉ chủ nhà hoặc admin mới được xoá thanh toán')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'write')
    const payment = await ContractPaymentRepository.findById(event, paymentId)
    if (!payment || payment.contractId !== contract.id) throwNotFound('Không tìm thấy thanh toán')
    return ContractPaymentRepository.deleteById(event, paymentId)
  },
}
