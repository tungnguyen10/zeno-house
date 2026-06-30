import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractRenewal } from '~/types/contract-renewals'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'
import { ContractRenewalRepository } from '../repositories/contract-renewals'
import { ContractRepository } from '../repositories/contracts'
import { ContractServiceRepository } from '../repositories/contract-services'
import { ContractOccupantRepository } from '../repositories/contract-occupants'
import { assertBuildingScope } from '../utils/scope'
import { AuditService } from './audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

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
    const resolvedContractId = contract.id
    if (contract.status === 'renewed') throwConflict('Hợp đồng đã được gia hạn thành hợp đồng mới, không thể gia hạn tiếp')
    if (contract.status === 'terminated') throwConflict('Hợp đồng đã chấm dứt, không thể gia hạn')

    const newEndDate = input.new_end_date
    if (newEndDate <= contract.endDate) {
      throwValidationError('Ngày kết thúc mới phải sau ngày kết thúc hiện tại')
    }

    const client = await serverSupabaseClient(event)
    const newRent = input.new_monthly_rent ?? contract.monthlyRent

    if (input.mode === 'extend') {
      // ORDER MATTERS: insert the log BEFORE mutating the contract.
      // If the contract UPDATE fails, we delete the log to roll back.
      // If we update first and the log insert fails, renewal_count gets bumped
      // without a matching log row → UI shows "N lần" with fewer entries.
      const renewal = await ContractRenewalRepository.insert(event, {
        contract_id: resolvedContractId,
        new_contract_id: null,
        mode: 'extend',
        old_end_date: contract.endDate,
        new_end_date: newEndDate,
        old_monthly_rent: contract.monthlyRent,
        new_monthly_rent: newRent,
        reason: input.reason ?? null,
        created_by: user.id,
      })

      const { error } = await client
        .from('contracts')
        .update({
          end_date: newEndDate,
          ...(newRent !== undefined && { monthly_rent: newRent }),
          original_end_date: contract.originalEndDate ?? contract.endDate,
          renewal_count: contract.renewalCount + 1,
        })
        .eq('id', resolvedContractId)
      if (error) {
        // Best-effort rollback: remove the orphan log row
        await ContractRenewalRepository.deleteById(event, renewal.id)
        throw createError({ statusCode: 500, message: error.message })
      }

      await AuditService.append(event, user, {
        building_id: contract.buildingId,
        action: AUDIT_ACTIONS.CONTRACT_RENEWED,
        entity_type: 'contract',
        entity_id: resolvedContractId,
        metadata: { mode: 'extend', renewal_id: renewal.id, new_end_date: newEndDate, new_monthly_rent: newRent },
      })

      return renewal
    }

    // mode === 'new_contract'
    // ORDER MATTERS: there is a partial unique index
    //   CREATE UNIQUE INDEX contracts_one_active_per_room ON contracts(room_id) WHERE status = 'active'
    // We must flip the old contract OUT of `active` BEFORE inserting the successor as `active`,
    // otherwise the insert violates the index.
    //
    // The old contract → `renewed` transition is done via the raw client (not ContractService.update)
    // so it does NOT trigger the room-release side effect (we want the room to stay `occupied`).
    const { error: markRenewedError } = await client
      .from('contracts')
      .update({ status: 'renewed' })
      .eq('id', resolvedContractId)
    if (markRenewedError) throw createError({ statusCode: 500, message: markRenewedError.message })

    // Now insert successor as active. If this fails, roll the old contract back to `active`
    // so the room is not left orphaned without an active contract.
    const newContractCode = await ContractRepository.allocateContractCode(
      event,
      contract.buildingId,
      contract.endDate,
    )
    const { data: newContractData, error: insertError } = await client
      .from('contracts')
      .insert({
        contract_code: newContractCode,
        room_id: contract.roomId,
        tenant_id: contract.tenantId,
        building_id: contract.buildingId,
        start_date: contract.endDate,
        end_date: newEndDate,
        monthly_rent: newRent,
        deposit: contract.deposit,
        payment_day: contract.paymentDay,
        occupant_count: contract.occupantCount,
        discount_amount: contract.discountAmount,
        surcharge_amount: contract.surchargeAmount,
        status: 'active',
        notes: contract.notes,
        previous_contract_id: resolvedContractId,
        renewal_count: contract.renewalCount + 1,
      })
      .select('id')
      .single()
    if (insertError) {
      // Best-effort rollback: restore old contract status
      await client.from('contracts').update({ status: 'active' }).eq('id', resolvedContractId)
      throw createError({ statusCode: 500, message: insertError.message })
    }

    // Carry forward billing-critical context to the successor.
    // Contract payments (deposit/prepaid/rent/other) are intentionally NOT copied.
    await ContractServiceRepository.cloneFromContract(event, resolvedContractId, newContractData.id)
    await ContractOccupantRepository.cloneActiveToContract(
      event,
      resolvedContractId,
      newContractData.id,
      contract.endDate,
    )

    const renewal = await ContractRenewalRepository.insert(event, {
      contract_id: resolvedContractId,
      new_contract_id: newContractData.id,
      mode: 'new_contract',
      old_end_date: contract.endDate,
      new_end_date: newEndDate,
      old_monthly_rent: contract.monthlyRent,
      new_monthly_rent: newRent,
      reason: input.reason ?? null,
      created_by: user.id,
    })

    await AuditService.append(event, user, {
      building_id: contract.buildingId,
      action: AUDIT_ACTIONS.CONTRACT_RENEWED,
      entity_type: 'contract',
      entity_id: resolvedContractId,
      metadata: { mode: 'new_contract', renewal_id: renewal.id, new_contract_id: newContractData.id, new_end_date: newEndDate, new_monthly_rent: newRent },
    })

    return renewal
  },
}
