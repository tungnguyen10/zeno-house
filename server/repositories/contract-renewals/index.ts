import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { ContractRenewal } from '~/types/contract-renewals'
import { mapContractRenewal } from '~/utils/mappers/contract-renewals'

export interface ContractRenewalInsertInput {
  contract_id: string
  new_contract_id: string | null
  mode: string
  old_end_date: string
  new_end_date: string
  old_monthly_rent: number
  new_monthly_rent: number
  reason: string | null
  created_by: string
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

  async insert(event: H3Event, input: ContractRenewalInsertInput): Promise<ContractRenewal> {
    // Use service-role: server is the only writer for renewal logs, and permission was
    // already verified at the service entry (`can(user, 'contracts.update')`).
    // RLS on contract_renewals stays strict as defense-in-depth for any direct client access.
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_renewals')
      .insert(input)
      .select()
      .single()
    if (error) {
      console.error('[ContractRenewalRepository.insert] failed', { input, error })
      throwDbError(error, 'contractRenewals.insert')
    }
    return mapContractRenewal(data)
  },

  async deleteById(event: H3Event, id: string): Promise<void> {
    // Best-effort cleanup used to roll back a log row when a follow-up write fails.
    // Uses service-role to mirror `insert()` and bypass RLS.
    const client = serverSupabaseClient(event)
    const { error } = await client.from('contract_renewals').delete().eq('id', id)
    if (error) {
      console.error('[ContractRenewalRepository.deleteById] rollback failed', { id, error })
    }
  },
}
