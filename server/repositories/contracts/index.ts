import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Contract, ContractWithDetails } from '~/types/contracts'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'
import { mapContract, mapContractWithDetails } from '~/utils/mappers/contracts'
import { isUuid } from '~/utils/format/slug'

export interface ContractFilters {
  room_id?: string
  tenant_id?: string
  building_id?: string
  status?: string
  page?: number
  limit?: number
}

const DETAIL_SELECT = `
  *,
  rooms!inner (id, room_number, floor, building_id, code, buildings (name)),
  tenants (id, full_name, phone, code)
`

function contractCodePrefix(buildingCode: string, startDate: string): string {
  const date = new Date(startDate)
  const year = Number.isFinite(date.getTime()) ? date.getUTCFullYear() : new Date().getUTCFullYear()
  return `hd-${buildingCode}-${year}`
}

function sequenceFromCode(prefix: string, code: string | null): number {
  if (!code?.startsWith(`${prefix}-`)) return 0
  const seq = Number(code.slice(prefix.length + 1))
  return Number.isInteger(seq) ? seq : 0
}

async function buildUniqueContractCode(event: H3Event, buildingCode: string, startDate: string): Promise<string> {
  const client = await serverSupabaseClient(event)
  const prefix = contractCodePrefix(buildingCode, startDate)
  const { data, error } = await client
    .from('contracts')
    .select('contract_code')
    .ilike('contract_code', `${prefix}-%`)

  if (error) throw createError({ statusCode: 500, message: error.message })

  const used = new Set((data ?? []).map(row => row.contract_code).filter(Boolean))
  let next = Math.max(0, ...(data ?? []).map(row => sequenceFromCode(prefix, row.contract_code))) + 1

  while (used.has(`${prefix}-${String(next).padStart(4, '0')}`)) next++
  return `${prefix}-${String(next).padStart(4, '0')}`
}

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
    if (filters.building_id) query = query.eq('building_id', filters.building_id)
    if (filters.status) query = query.eq('status', filters.status)

    const { data, error, count } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })
    return {
      items: (data ?? []).map((row) => mapContractWithDetails(row as Parameters<typeof mapContractWithDetails>[0])),
      total: count ?? 0,
    }
  },

  async findById(event: H3Event, id: string): Promise<ContractWithDetails | null> {
    return this.findByIdentifier(event, id)
  },

  async findByIdentifier(event: H3Event, identifier: string): Promise<ContractWithDetails | null> {
    const client = await serverSupabaseClient(event)
    const column = isUuid(identifier) ? 'id' : 'contract_code'
    const { data, error } = await client
      .from('contracts')
      .select(DETAIL_SELECT)
      .eq(column, identifier)
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

  async findActiveByTenantId(event: H3Event, tenantId: string, excludeContractId?: string): Promise<Contract | null> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('contracts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
    if (excludeContractId) query = query.neq('id', excludeContractId)
    const { data, error } = await query.maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapContract(data) : null
  },

  async insert(event: H3Event, input: ContractCreateInput): Promise<ContractWithDetails> {
    const client = await serverSupabaseClient(event)
    if (!input.building_id) {
      throw createError({ statusCode: 500, message: 'building_id is required on insert (resolve from room before calling repository)' })
    }

    // Resolve building code for contract code generation
    const { data: buildingRow, error: buildingError } = await client
      .from('buildings')
      .select('code')
      .eq('id', input.building_id)
      .single()
    if (buildingError || !buildingRow) {
      throw createError({ statusCode: 500, message: 'Cannot resolve building code for contract' })
    }

    const contractCode = await buildUniqueContractCode(event, buildingRow.code, input.start_date)
    const { data, error } = await client
      .from('contracts')
      .insert({
        contract_code: contractCode,
        room_id: input.room_id,
        tenant_id: input.tenant_id,
        building_id: input.building_id,
        start_date: input.start_date,
        end_date: input.end_date,
        monthly_rent: input.monthly_rent,
        deposit: input.deposit ?? 0,
        payment_day: input.payment_day ?? null,
        occupant_count: input.occupant_count ?? 1,
        discount_amount: input.discount_amount ?? 0,
        surcharge_amount: input.surcharge_amount ?? 0,
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
        ...(input.building_id !== undefined && input.building_id !== null && { building_id: input.building_id }),
        ...(input.start_date !== undefined && { start_date: input.start_date }),
        ...(input.end_date !== undefined && { end_date: input.end_date }),
        ...(input.monthly_rent !== undefined && { monthly_rent: input.monthly_rent }),
        ...(input.deposit !== undefined && { deposit: input.deposit }),
        ...(input.payment_day !== undefined && { payment_day: input.payment_day }),
        ...(input.occupant_count !== undefined && { occupant_count: input.occupant_count }),
        ...(input.discount_amount !== undefined && { discount_amount: input.discount_amount }),
        ...(input.surcharge_amount !== undefined && { surcharge_amount: input.surcharge_amount }),
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
