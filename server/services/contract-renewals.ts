import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractRenewal } from '~/types/contract-renewals'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'
import { ContractRenewalRepository } from '../repositories/contract-renewals'
import { ContractRepository } from '../repositories/contracts'

export const ContractRenewalService = {
  async list(event: H3Event, user: AuthUser, contractId: string): Promise<ContractRenewal[]> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem lịch sử gia hạn')
    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    return ContractRenewalRepository.listByContract(event, contractId)
  },

  async renew(event: H3Event, user: AuthUser, contractId: string, input: ContractRenewInput): Promise<ContractRenewal> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền gia hạn hợp đồng')

    const contract = await ContractRepository.findById(event, contractId)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    if (contract.status === 'renewed') throwConflict('Hợp đồng đã được gia hạn thành hợp đồng mới, không thể gia hạn tiếp')
    if (contract.status === 'terminated') throwConflict('Hợp đồng đã chấm dứt, không thể gia hạn')

    const newEndDate = input.new_end_date
    if (newEndDate <= contract.endDate) {
      throwValidationError('Ngày kết thúc mới phải sau ngày kết thúc hiện tại')
    }

    const client = await serverSupabaseClient(event)
    const newRent = input.new_monthly_rent ?? contract.monthlyRent

    if (input.mode === 'extend') {
      // Update contract end_date in place, preserve original_end_date
      const { error } = await client
        .from('contracts')
        .update({
          end_date: newEndDate,
          ...(newRent !== undefined && { monthly_rent: newRent }),
          original_end_date: contract.originalEndDate ?? contract.endDate,
          renewal_count: contract.renewalCount + 1,
        })
        .eq('id', contractId)
      if (error) throw createError({ statusCode: 500, message: error.message })

      return ContractRenewalRepository.insert(event, {
        contract_id: contractId,
        new_contract_id: null,
        mode: 'extend',
        old_end_date: contract.endDate,
        new_end_date: newEndDate,
        old_monthly_rent: contract.monthlyRent,
        new_monthly_rent: newRent,
        reason: input.reason ?? null,
        created_by: user.id,
      })
    }

    // mode === 'new_contract'
    // Create successor contract
    const { data: newContractData, error: insertError } = await client
      .from('contracts')
      .insert({
        room_id: contract.roomId,
        tenant_id: contract.tenantId,
        building_id: contract.buildingId,
        start_date: contract.endDate,
        end_date: newEndDate,
        monthly_rent: newRent,
        deposit: contract.deposit,
        occupant_count: contract.occupantCount,
        discount_amount: contract.discountAmount,
        surcharge_amount: contract.surchargeAmount,
        status: 'active',
        notes: contract.notes,
        previous_contract_id: contractId,
        renewal_count: contract.renewalCount + 1,
      })
      .select('id')
      .single()
    if (insertError) throw createError({ statusCode: 500, message: insertError.message })

    // Mark old contract as renewed
    const { error: updateError } = await client
      .from('contracts')
      .update({ status: 'renewed' })
      .eq('id', contractId)
    if (updateError) throw createError({ statusCode: 500, message: updateError.message })

    return ContractRenewalRepository.insert(event, {
      contract_id: contractId,
      new_contract_id: newContractData.id,
      mode: 'new_contract',
      old_end_date: contract.endDate,
      new_end_date: newEndDate,
      old_monthly_rent: contract.monthlyRent,
      new_monthly_rent: newRent,
      reason: input.reason ?? null,
      created_by: user.id,
    })
  },
}
