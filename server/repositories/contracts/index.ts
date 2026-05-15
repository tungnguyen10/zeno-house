import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Contract, ContractWithDetails } from '~/types/contracts'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'
import { mapContract, mapContractWithDetails } from '~/utils/mappers/contracts'

export interface ContractFilters {
  room_id?: string
  tenant_id?: string
  status?: string
  page?: number
  limit?: number
}

const DETAIL_SELECT = `
  *,
  rooms (id, room_number, floor, buildings (name)),
  tenants (id, full_name, phone)
`

export const ContractRepository = {
  async findAll(
    event: H3Event,
    filters: ContractFilters = {},
  ): Promise<{ items: ContractWithDetails[]; total: number }> {
    const client = await serverSupabaseClient(event)
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = client
      .from('contracts')
      .select(DETAIL_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.room_id) query = query.eq('room_id', filters.room_id)
    if (filters.tenant_id) query = query.eq('tenant_id', filters.tenant_id)
    if (filters.status) query = query.eq('status', filters.status)

    const { data, error, count } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })
    return {
      items: (data ?? []).map((row) => mapContractWithDetails(row as Parameters<typeof mapContractWithDetails>[0])),
      total: count ?? 0,
    }
  },

  async findById(event: H3Event, id: string): Promise<ContractWithDetails | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contracts')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return null
    return mapContractWithDetails(data as Parameters<typeof mapContractWithDetails>[0])
  },

  async findActiveByRoomId(event: H3Event, roomId: string, excludeId?: string): Promise<Contract | null> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('contracts')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
    if (excludeId) query = query.neq('id', excludeId)
    const { data, error } = await query.maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapContract(data) : null
  },

  async insert(event: H3Event, input: ContractCreateInput): Promise<ContractWithDetails> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contracts')
      .insert({
        room_id: input.room_id,
        tenant_id: input.tenant_id,
        start_date: input.start_date,
        end_date: input.end_date,
        monthly_rent: input.monthly_rent,
        deposit: input.deposit ?? 0,
        status: input.status ?? 'active',
        notes: input.notes ?? null,
      })
      .select(DETAIL_SELECT)
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapContractWithDetails(data as Parameters<typeof mapContractWithDetails>[0])
  },

  async update(event: H3Event, id: string, input: ContractUpdateInput): Promise<ContractWithDetails> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contracts')
      .update({
        ...(input.room_id !== undefined && { room_id: input.room_id }),
        ...(input.tenant_id !== undefined && { tenant_id: input.tenant_id }),
        ...(input.start_date !== undefined && { start_date: input.start_date }),
        ...(input.end_date !== undefined && { end_date: input.end_date }),
        ...(input.monthly_rent !== undefined && { monthly_rent: input.monthly_rent }),
        ...(input.deposit !== undefined && { deposit: input.deposit }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
      })
      .eq('id', id)
      .select(DETAIL_SELECT)
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapContractWithDetails(data as Parameters<typeof mapContractWithDetails>[0])
  },

  async remove(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('contracts').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
