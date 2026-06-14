import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Tenant } from '~/types/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'
import { mapTenant } from '~/utils/mappers/tenants'

export interface TenantFilters {
  q?: string
  building_id?: string
  page?: number
  limit?: number
  available?: boolean
  excludeContractId?: string
}

export const TenantRepository = {
  async findAll(
    event: H3Event,
    filters: TenantFilters = {},
  ): Promise<{ items: Tenant[]; total: number }> {
    const client = await serverSupabaseClient(event)
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = client
      .from('tenants')
      .select('*', { count: 'exact' })
      .order('full_name', { ascending: true })
      .range(from, to)

    if (filters.building_id) {
      const { data: contracts, error: contractError } = await client
        .from('contracts')
        .select('id, tenant_id')
        .eq('building_id', filters.building_id)

      if (contractError) throw createError({ statusCode: 500, message: contractError.message })

      const contractIds = (contracts ?? []).map(contract => contract.id)
      const primaryTenantIds = (contracts ?? []).map(contract => contract.tenant_id)
      let occupantTenantIds: string[] = []

      if (contractIds.length > 0) {
        const { data: occupants, error: occupantError } = await client
          .from('contract_occupants')
          .select('tenant_id')
          .in('contract_id', contractIds)

        if (occupantError) throw createError({ statusCode: 500, message: occupantError.message })
        occupantTenantIds = (occupants ?? []).map(occupant => occupant.tenant_id)
      }

      const tenantIds = [...new Set([...primaryTenantIds, ...occupantTenantIds])]
      if (tenantIds.length === 0) {
        return { items: [], total: 0 }
      }

      query = query.in('id', tenantIds)
    }

    if (filters.q) {
      query = query.or(`full_name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%`)
    }

    if (filters.available) {
      // Exclude tenants who are primary on another active contract
      let primaryQuery = client.from('contracts').select('tenant_id').eq('status', 'active')
      if (filters.excludeContractId) primaryQuery = primaryQuery.neq('id', filters.excludeContractId)
      const { data: primaryContracts } = await primaryQuery
      const primaryIds = (primaryContracts ?? []).map((c) => c.tenant_id)

      // Exclude tenants who are active occupants in another contract
      let occupantQuery = client.from('contract_occupants').select('tenant_id').is('move_out_date', null)
      if (filters.excludeContractId) occupantQuery = occupantQuery.neq('contract_id', filters.excludeContractId)
      const { data: activeOccupants } = await occupantQuery
      const occupantIds = (activeOccupants ?? []).map((o) => o.tenant_id)

      const occupiedIds = [...new Set([...primaryIds, ...occupantIds])]
      if (occupiedIds.length > 0) {
        query = query.not('id', 'in', `(${occupiedIds.join(',')})`)
      }
    }

    const { data, error, count } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { items: (data ?? []).map(mapTenant), total: count ?? 0 }
  },

  async findById(event: H3Event, id: string): Promise<Tenant | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('tenants')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapTenant(data) : null
  },

  async findByIdNumber(event: H3Event, idNumber: string, excludeId?: string): Promise<Tenant | null> {
    const client = await serverSupabaseClient(event)
    let query = client.from('tenants').select('*').eq('id_number', idNumber)
    if (excludeId) query = query.neq('id', excludeId)
    const { data, error } = await query.maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapTenant(data) : null
  },

  async insert(event: H3Event, input: TenantCreateInput): Promise<Tenant> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('tenants')
      .insert({
        full_name: input.full_name,
        phone: input.phone,
        email: input.email ?? null,
        id_number: input.id_number ?? null,
        date_of_birth: input.date_of_birth ?? null,
        permanent_address: input.permanent_address ?? null,
        notes: input.notes ?? null,
        gender: input.gender ?? null,
        occupation: input.occupation ?? null,
        id_issued_date: input.id_issued_date ?? null,
        id_issued_place: input.id_issued_place ?? null,
        emergency_contact_name: input.emergency_contact_name ?? null,
        emergency_contact_phone: input.emergency_contact_phone ?? null,
      })
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapTenant(data)
  },

  async update(event: H3Event, id: string, input: TenantUpdateInput): Promise<Tenant> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('tenants')
      .update({
        ...(input.full_name !== undefined && { full_name: input.full_name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.id_number !== undefined && { id_number: input.id_number }),
        ...(input.date_of_birth !== undefined && { date_of_birth: input.date_of_birth }),
        ...(input.permanent_address !== undefined && { permanent_address: input.permanent_address }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.gender !== undefined && { gender: input.gender }),
        ...(input.occupation !== undefined && { occupation: input.occupation }),
        ...(input.id_issued_date !== undefined && { id_issued_date: input.id_issued_date }),
        ...(input.id_issued_place !== undefined && { id_issued_place: input.id_issued_place }),
        ...(input.emergency_contact_name !== undefined && { emergency_contact_name: input.emergency_contact_name }),
        ...(input.emergency_contact_phone !== undefined && { emergency_contact_phone: input.emergency_contact_phone }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapTenant(data)
  },

  async remove(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('tenants').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
