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
    // Temporary RPC adapter until the approved cloud migration is applied and
    // database.types.ts is regenerated. Keep its name and arguments narrowly typed.
    const rpc = client.rpc.bind(client) as unknown as (
      name: 'renew_contract_atomic',
      params: {
        p_contract_id: string
        p_mode: RenewAtomicArgs['mode']
        p_new_end_date: string
        p_new_monthly_rent: number | null
        p_reason: string | null
        p_actor_id: string
        p_operation_id: string
        p_correlation_id: string
      },
    ) => PromiseLike<{ data: RenewAtomicPayload | null, error: unknown }>
    const { data, error } = await rpc('renew_contract_atomic', {
      p_contract_id: args.contractId,
      p_mode: args.mode,
      p_new_end_date: args.newEndDate,
      p_new_monthly_rent: args.newMonthlyRent,
      p_reason: args.reason,
      p_actor_id: args.actorId,
      p_operation_id: args.operationId,
      p_correlation_id: args.correlationId,
    })
    if (error) throwDbError(error, 'contractRenewals.renewAtomic')
    if (!data) throwInternal(new Error('Empty renewal RPC result'), 'contractRenewals.renewAtomic')
    return {
      renewal: mapContractRenewal(data.renewal),
      newContractId: data.new_contract?.id ?? null,
      transferredSourceIds: data.transferred_source_ids,
      replayed: data.replayed,
    }
  },
}
