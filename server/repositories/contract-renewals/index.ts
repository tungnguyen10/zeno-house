import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Tables } from '~/types/database.types'
import type { ContractRenewal } from '~/types/contract-renewals'
import { mapContractRenewal } from '~/utils/mappers/contract-renewals'

export interface RenewAtomicArgs {
  contractId: string
  mode: 'extend' | 'new_contract'
  newEndDate: string
  newMonthlyRent: number | null
  reason: string | null
  actorId: string
  operationId: string
  correlationId: string
}

export interface RenewAtomicResult {
  renewal: ContractRenewal
  newContractId: string | null
  transferredSourceIds: string[]
  replayed: boolean
}

interface RenewAtomicPayload {
  renewal: Tables<'contract_renewals'>
  new_contract: { id: string } | null
  transferred_source_ids: string[]
  replayed: boolean
}

export const ContractRenewalRepository = {
  async listByContract(event: H3Event, contractId: string): Promise<ContractRenewal[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_renewals')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
    if (error) throwDbError(error, 'contractRenewals.listByContract')
    return (data ?? []).map(mapContractRenewal)
  },

  async renewAtomic(event: H3Event, args: RenewAtomicArgs): Promise<RenewAtomicResult> {
    const client = serverSupabaseClient(event)
    // The RPC accepts null for rent (keep current) and reason, but generated types mark them non-null.
    const { data, error } = await client.rpc('renew_contract_atomic', {
      p_contract_id: args.contractId,
      p_mode: args.mode,
      p_new_end_date: args.newEndDate,
      p_new_monthly_rent: args.newMonthlyRent as number,
      p_reason: args.reason as string,
      p_actor_id: args.actorId,
      p_operation_id: args.operationId,
      p_correlation_id: args.correlationId,
    })
    if (error) throwDbError(error, 'contractRenewals.renewAtomic')
    if (!data) throwInternal(new Error('Empty renewal RPC result'), 'contractRenewals.renewAtomic')
    const payload = data as unknown as RenewAtomicPayload
    return {
      renewal: mapContractRenewal(payload.renewal),
      newContractId: payload.new_contract?.id ?? null,
      transferredSourceIds: payload.transferred_source_ids,
      replayed: payload.replayed,
    }
  },
}
