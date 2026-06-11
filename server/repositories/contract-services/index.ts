import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import { mapContractService } from '~/utils/mappers/contract-services'

export const ContractServiceRepository = {
  async findByContract(event: H3Event, contractId: string): Promise<ContractService[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_services')
      .select('*, service_catalog(*)')
      .eq('contract_id', contractId)
      .order('catalog_id', { ascending: true })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(row => mapContractService(row as Parameters<typeof mapContractService>[0]))
  },

  async cloneFromBuilding(
    event: H3Event,
    contractId: string,
    buildingId: string,
  ): Promise<void> {
    const client = await serverSupabaseClient(event)

    const { data: buildingServices, error: fetchError } = await client
      .from('building_services')
      .select('catalog_id, default_amount')
      .eq('building_id', buildingId)
      .eq('is_active', true)

    if (fetchError || !buildingServices || buildingServices.length === 0) return

    const rows = buildingServices.map(bs => ({
      contract_id: contractId,
      catalog_id: bs.catalog_id,
      amount: bs.default_amount,
      quantity: 1,
      is_enabled: true,
    }))

    const { error: insertError } = await client
      .from('contract_services')
      .insert(rows)

    if (insertError) {
      console.error('[ContractServiceRepository.cloneFromBuilding]', insertError.message)
    }
  },

  async cloneFromContract(
    event: H3Event,
    sourceContractId: string,
    targetContractId: string,
  ): Promise<void> {
    const client = await serverSupabaseClient(event)

    const { data: sourceServices, error: fetchError } = await client
      .from('contract_services')
      .select('catalog_id, amount, quantity, is_enabled, notes')
      .eq('contract_id', sourceContractId)

    if (fetchError || !sourceServices || sourceServices.length === 0) return

    const rows = sourceServices.map(s => ({
      contract_id: targetContractId,
      catalog_id: s.catalog_id,
      amount: s.amount,
      quantity: s.quantity,
      is_enabled: s.is_enabled,
      notes: s.notes ?? null,
    }))

    const { error: insertError } = await client
      .from('contract_services')
      .upsert(rows, { onConflict: 'contract_id,catalog_id' })

    if (insertError) {
      console.error('[ContractServiceRepository.cloneFromContract]', insertError.message)
    }
  },

  async syncFromBuilding(
    event: H3Event,
    buildingId: string,
  ): Promise<number> {
    const client = await serverSupabaseClient(event)

    // Get all active building services
    const { data: buildingServices, error: bsError } = await client
      .from('building_services')
      .select('catalog_id, default_amount')
      .eq('building_id', buildingId)
      .eq('is_active', true)

    if (bsError || !buildingServices || buildingServices.length === 0) return 0

    // Get all active contracts for this building via rooms join
    const { data: contracts, error: cError } = await client
      .from('contracts')
      .select('id, rooms!inner(building_id)')
      .eq('rooms.building_id', buildingId)
      .eq('status', 'active')

    if (cError || !contracts || contracts.length === 0) return 0

    let added = 0
    for (const contract of contracts) {
      const rows = buildingServices.map(bs => ({
        contract_id: contract.id,
        catalog_id: bs.catalog_id,
        amount: bs.default_amount,
        quantity: 1,
        is_enabled: true,
      }))
      const { error: insertError, count } = await client
        .from('contract_services')
        .upsert(rows, { onConflict: 'contract_id,catalog_id', ignoreDuplicates: true })
        .select()
      if (!insertError) added += count ?? 0
    }
    return added
  },

  async findByBuilding(
    event: H3Event,
    buildingId: string,
  ): Promise<ContractService[]> {
    const client = await serverSupabaseClient(event)

    // Get active contract IDs for this building via rooms (building_id may be null on old contracts)
    const { data: contracts, error: cError } = await client
      .from('contracts')
      .select('id, rooms!inner(building_id)')
      .eq('rooms.building_id', buildingId)
      .eq('status', 'active')

    if (cError || !contracts || contracts.length === 0) return []

    const contractIds = contracts.map(c => c.id)

    const { data, error } = await client
      .from('contract_services')
      .select('*, service_catalog(*)')
      .in('contract_id', contractIds)

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(row => mapContractService(row as Parameters<typeof mapContractService>[0]))
  },

  async update(
    event: H3Event,
    id: string,
    input: ContractServiceUpdateInput,
  ): Promise<ContractService> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_services')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, service_catalog(*)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) throw createError({ statusCode: 404, message: 'Không tìm thấy' })
    return mapContractService(data as Parameters<typeof mapContractService>[0])
  },
}
