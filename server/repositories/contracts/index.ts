import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Database } from '~/types/database.types'
import type { Contract, ContractStatus, ContractWithDetails } from '~/types/contracts'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'
import { mapContract, mapContractWithDetails } from '~/utils/mappers/contracts'
import { isUuid } from '~/utils/format/slug'

export interface ContractFilters {
  room_id?: string
  tenant_id?: string
  building_id?: string
  buildingIds?: string[] | null
  status?: ContractStatus[]
  q?: string
  sort?: 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'
  order?: 'asc' | 'desc'
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

  if (error) throwDbError(error, 'contracts.buildUniqueContractCode')

  const used = new Set((data ?? []).map(row => row.contract_code).filter(Boolean))
  let next = Math.max(0, ...(data ?? []).map(row => sequenceFromCode(prefix, row.contract_code))) + 1

  while (used.has(`${prefix}-${String(next).padStart(4, '0')}`)) next++
  return `${prefix}-${String(next).padStart(4, '0')}`
}

export const ContractRepository = {
  async allocateContractCode(event: H3Event, buildingId: string, startDate: string): Promise<string> {
    const client = await serverSupabaseClient(event)
    const { data: buildingRow, error: buildingError } = await client
      .from('buildings')
      .select('code')
      .eq('id', buildingId)
      .single()
    if (buildingError || !buildingRow) {
      throwInternal(buildingError, 'contracts.allocateContractCode')
    }
    return buildUniqueContractCode(event, buildingRow.code, startDate)
  },

  async findAll(
    event: H3Event,
    filters: ContractFilters = {},
  ): Promise<{ items: ContractWithDetails[]; total: number }> {
    if (filters.buildingIds && filters.buildingIds.length === 0) {
      return { items: [], total: 0 }
    }

    const client = await serverSupabaseClient(event)
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1
    const sort = filters.sort ?? 'created_at'
    const order = filters.order ?? 'desc'
    const ascending = order === 'asc'

    let query = client
      .from('contracts')
      .select(DETAIL_SELECT, { count: 'exact' })

    if (filters.room_id) query = query.eq('room_id', filters.room_id)
    if (filters.tenant_id) query = query.eq('tenant_id', filters.tenant_id)
    if (filters.building_id) query = query.eq('building_id', filters.building_id)
    else if (filters.buildingIds) query = query.in('building_id', filters.buildingIds)
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters.q && filters.q.trim()) {
      const term = filters.q.trim().replace(/[,()]/g, '')
      // Search across contract_code (local) + tenants.full_name + rooms.room_number.
      // PostgREST `.or()` across embedded tables is unreliable, so we resolve
      // matching tenant/room IDs first then OR-filter the parent rows on FK.
      const [tenantsRes, roomsRes] = await Promise.all([
        client.from('tenants').select('id').ilike('full_name', `%${term}%`),
        client.from('rooms').select('id').ilike('room_number', `%${term}%`),
      ])
      if (tenantsRes.error) throwDbError(tenantsRes.error, 'contracts.findAll.tenants')
      if (roomsRes.error) throwDbError(roomsRes.error, 'contracts.findAll.rooms')

      const tenantIds = (tenantsRes.data ?? []).map(row => row.id)
      const roomIds = (roomsRes.data ?? []).map(row => row.id)

      const orParts = [`contract_code.ilike.%${term}%`]
      if (tenantIds.length > 0) orParts.push(`tenant_id.in.(${tenantIds.join(',')})`)
      if (roomIds.length > 0) orParts.push(`room_id.in.(${roomIds.join(',')})`)

      query = query.or(orParts.join(','))
    }

    query = query.order(sort, { ascending })
    if (sort !== 'created_at') query = query.order('created_at', { ascending: false })
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) throwDbError(error, 'contracts.findAll')
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

    if (error) throwDbError(error, 'contracts.findByIdentifier')
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
    if (error) throwDbError(error, 'contracts.findActiveByRoomId')
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
    if (error) throwDbError(error, 'contracts.findActiveByTenantId')
    return data ? mapContract(data) : null
  },

  async insert(event: H3Event, input: ContractCreateInput): Promise<ContractWithDetails> {
    // Retained for the contract-renewal flow which inserts contracts directly
    // (without handover meter readings). New-contract creates go through
    // `createWithHandover` so the contract + handover readings commit atomically.
    const client = await serverSupabaseClient(event)
    if (!input.building_id) {
      throwInternal(new Error('building_id is required on insert (resolve from room before calling repository)'), 'contracts.insert.buildingId')
    }

    const contractCode = await this.allocateContractCode(event, input.building_id, input.start_date)
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

    if (error) throwDbError(error, 'contracts.insert')
    return mapContractWithDetails(data as Parameters<typeof mapContractWithDetails>[0])
  },

  async createWithHandover(
    event: H3Event,
    input: ContractCreateInput & { building_id: string },
    recordedBy: string | null,
  ): Promise<ContractWithDetails> {
    const client = await serverSupabaseClient(event)

    const readingDate = input.handover_reading_date && input.handover_reading_date.length > 0
      ? input.handover_reading_date
      : input.start_date

    // Supabase typegen does not reflect SQL `DEFAULT NULL` on params, so the
    // generated Args type rejects null for `p_payment_day`, `p_notes`, and
    // `p_recorded_by`. Mirror the cast pattern used by `issue_period_invoices`.
    const args = {
      p_room_id: input.room_id,
      p_tenant_id: input.tenant_id,
      p_building_id: input.building_id,
      p_start_date: input.start_date,
      p_end_date: input.end_date,
      p_monthly_rent: input.monthly_rent,
      p_deposit: input.deposit ?? 0,
      p_payment_day: input.payment_day ?? null,
      p_occupant_count: input.occupant_count ?? 1,
      p_discount_amount: input.discount_amount ?? 0,
      p_surcharge_amount: input.surcharge_amount ?? 0,
      p_status: input.status ?? 'active',
      p_notes: input.notes ?? null,
      p_handover_electricity_reading: input.handover_electricity_reading,
      p_handover_water_reading: input.handover_water_reading,
      p_handover_reading_date: readingDate,
      p_recorded_by: recordedBy,
    } as unknown as Database['public']['Functions']['create_contract_with_handover']['Args']

    const { data, error } = await client.rpc('create_contract_with_handover', args)
    if (error) {
      // 23505 (unique violation) and P0001 (raised in RPC) both indicate a
      // business conflict the admin can act on; everything else is a 500.
      const isConflict = (error as { code?: string }).code === '23505'
        || (error as { code?: string }).code === 'P0001'
      if (isConflict) throwConflict(error.message)
      throwDbError(error, 'contracts.createWithHandover')
    }

    const rows = (data as Array<{ id: string }> | null) ?? []
    if (rows.length === 0) {
      throwInternal(new Error('create_contract_with_handover returned no rows'), 'contracts.createWithHandover')
    }
    const created = await this.findByIdentifier(event, rows[0]!.id)
    if (!created) {
      throwInternal(new Error('Contract was inserted but cannot be re-read'), 'contracts.createWithHandover.reread')
    }
    return created
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

    if (error) throwDbError(error, 'contracts.update')
    return mapContractWithDetails(data as Parameters<typeof mapContractWithDetails>[0])
  },

  async remove(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('contracts').delete().eq('id', id)
    if (error) throwDbError(error, 'contracts.remove')
  },

  async removeWithCascade(event: H3Event, contract: ContractWithDetails): Promise<void> {
    const client = await serverSupabaseClient(event)

    const deletes = [
      client.from('contract_payments').delete().eq('contract_id', contract.id),
      client.from('contract_services').delete().eq('contract_id', contract.id),
      client.from('contract_occupants').delete().eq('contract_id', contract.id),
      client.from('contract_renewals').delete().eq('contract_id', contract.id),
      client.from('contract_renewals').delete().eq('new_contract_id', contract.id),
      client
        .from('meter_readings')
        .delete()
        .eq('room_id', contract.roomId)
        .in('reading_type', ['handover_in', 'handover_out'])
        .gte('reading_date', contract.startDate)
        .lte('reading_date', contract.endDate),
    ]

    for (const result of await Promise.all(deletes)) {
      if (result.error) throwDbError(result.error, 'contracts.removeWithCascade')
    }

    await this.remove(event, contract.id)
  },

  async countBillingPeriodsForContract(event: H3Event, contractId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('billing_period_id')
      .eq('contract_id', contractId)
      .neq('status', 'void')

    if (error) throwDbError(error, 'contracts.countBillingPeriodsForContract')
    return new Set((data ?? []).map(row => row.billing_period_id)).size
  },

  async countPaidInvoicesForContract(event: H3Event, contractId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { count, error } = await client
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('contract_id', contractId)
      .in('status', ['paid', 'partial'])

    if (error) throwDbError(error, 'contracts.countPaidInvoicesForContract')
    return count ?? 0
  },

  async countNonHandoverMeterReadingsForContract(event: H3Event, contractId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { data: contract, error: contractError } = await client
      .from('contracts')
      .select('room_id, start_date, end_date')
      .eq('id', contractId)
      .maybeSingle()

    if (contractError) throwDbError(contractError, 'contracts.countNonHandoverMeterReadingsForContract.contract')
    if (!contract) return 0

    const { count, error } = await client
      .from('meter_readings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', contract.room_id)
      .not('reading_type', 'in', '(handover_in,handover_out)')
      .gte('reading_date', contract.start_date)
      .lte('reading_date', contract.end_date)

    if (error) throwDbError(error, 'contracts.countNonHandoverMeterReadingsForContract')
    return count ?? 0
  },
}
