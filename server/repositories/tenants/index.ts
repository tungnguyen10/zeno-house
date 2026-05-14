import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Tenant } from '~/types/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'
import { mapTenant } from '~/utils/mappers/tenants'

export interface TenantFilters {
  q?: string
  page?: number
  limit?: number
  unassigned?: boolean
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

    if (filters.q) {
      query = query.or(`full_name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%`)
    }

    if (filters.unassigned) {
      const { data: activeAssignments } = await client
        .from('room_assignments')
        .select('tenant_id')
        .is('end_date', null)
      const assignedIds = (activeAssignments ?? []).map((a) => a.tenant_id)
      if (assignedIds.length > 0) {
        query = query.not('id', 'in', `(${assignedIds.join(',')})`)
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
