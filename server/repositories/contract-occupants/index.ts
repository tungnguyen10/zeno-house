import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { ContractOccupant } from '~/types/contract-occupants'
import type { ContractOccupantAddInput, ContractOccupantMoveOutInput } from '~/utils/validators/contract-occupants'
import { mapContractOccupant } from '~/utils/mappers/contract-occupants'

export const ContractOccupantRepository = {
  async listByContract(event: H3Event, contractId: string): Promise<ContractOccupant[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_occupants')
      .select('*, tenants(full_name, phone)')
      .eq('contract_id', contractId)
      .order('move_in_date', { ascending: true })
    if (error) throwDbError(error, 'contractOccupants.listByContract')
    return (data ?? []).map(row => mapContractOccupant(row as Parameters<typeof mapContractOccupant>[0]))
  },

  async findById(event: H3Event, occupantId: string): Promise<ContractOccupant | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_occupants')
      .select('*')
      .eq('id', occupantId)
      .maybeSingle()
    if (error) throwDbError(error, 'contractOccupants.findById')
    return data ? mapContractOccupant(data) : null
  },

  async findActiveByTenant(event: H3Event, contractId: string, tenantId: string): Promise<ContractOccupant | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_occupants')
      .select('*')
      .eq('contract_id', contractId)
      .eq('tenant_id', tenantId)
      .is('move_out_date', null)
      .maybeSingle()
    if (error) throwDbError(error, 'contractOccupants.findActiveByTenant')
    return data ? mapContractOccupant(data) : null
  },

  async findActiveOccupancyByTenant(event: H3Event, tenantId: string, excludeContractId?: string): Promise<ContractOccupant | null> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('contract_occupants')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('move_out_date', null)
    if (excludeContractId) query = query.neq('contract_id', excludeContractId)
    const { data, error } = await query.maybeSingle()
    if (error) throwDbError(error, 'contractOccupants.findActiveOccupancyByTenant')
    return data ? mapContractOccupant(data) : null
  },

  async insert(event: H3Event, contractId: string, input: ContractOccupantAddInput): Promise<ContractOccupant> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_occupants')
      .insert({
        contract_id: contractId,
        tenant_id: input.tenant_id,
        role: input.role,
        move_in_date: input.move_in_date,
        billing_counted: input.billing_counted,
      })
      .select('*, tenants(full_name, phone)')
      .single()
    if (error) throwDbError(error, 'contractOccupants.insert')
    return mapContractOccupant(data as Parameters<typeof mapContractOccupant>[0])
  },

  async updateById(event: H3Event, occupantId: string, input: ContractOccupantMoveOutInput): Promise<ContractOccupant> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_occupants')
      .update({ move_out_date: input.move_out_date })
      .eq('id', occupantId)
      .select()
      .single()
    if (error) throwDbError(error, 'contractOccupants.updateById')
    return mapContractOccupant(data)
  },

  async deleteById(event: H3Event, occupantId: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('contract_occupants')
      .delete()
      .eq('id', occupantId)
    if (error) throwDbError(error, 'contractOccupants.deleteById')
  },

  async cloneActiveToContract(
    event: H3Event,
    sourceContractId: string,
    targetContractId: string,
    moveInDate: string,
  ): Promise<void> {
    const client = await serverSupabaseClient(event)

    const { data: activeOccupants, error: fetchError } = await client
      .from('contract_occupants')
      .select('tenant_id, role, billing_counted')
      .eq('contract_id', sourceContractId)
      .is('move_out_date', null)

    if (fetchError || !activeOccupants || activeOccupants.length === 0) return

    const rows = activeOccupants.map(o => ({
      contract_id: targetContractId,
      tenant_id: o.tenant_id,
      role: o.role,
      move_in_date: moveInDate,
      billing_counted: o.billing_counted,
    }))

    const { error: insertError } = await client
      .from('contract_occupants')
      .insert(rows)

    if (insertError) {
      console.error('[ContractOccupantRepository.cloneActiveToContract]', insertError.message)
    }
  },
}
