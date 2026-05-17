import { serverSupabaseClient } from '#supabase/server'
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
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapContractRenewal)
  },

  async insert(event: H3Event, input: ContractRenewalInsertInput): Promise<ContractRenewal> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_renewals')
      .insert(input)
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapContractRenewal(data)
  },
}
