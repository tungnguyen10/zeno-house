import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Tenant, TenantStatus } from '~/types/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'
import { mapTenant } from '~/utils/mappers/tenants'
import { isUuid } from '~/utils/format/slug'
import { nameInitialsFromFullName } from '~/utils/format/codes'

export interface TenantFilters {
  q?: string
  building_id?: string
  buildingIds?: string[] | null
  contract_state?: 'with_contract' | 'without_contract'
  status?: TenantStatus[]
  sort?: 'full_name' | 'created_at' | 'code'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
  available?: boolean
  excludeContractId?: string
}

interface TenantAssignment {
  contractId: string
  roomId: string
  roomNumber: string
  buildingId: string
  buildingName: string
  buildingSlug: string | null
}

async function buildUniqueTenantCode(
  event: H3Event,
  fullName: string,
  createdAt: string,
): Promise<string> {
  const client = await serverSupabaseClient(event)
  const initials = nameInitialsFromFullName(fullName) || 'kh'
  const year = new Date(createdAt).getUTCFullYear()
  const prefix = `${initials}-${year}`

  const { data, error } = await client
    .from('tenants')
    .select('code')
    .ilike('code', `${prefix}-%`)

  if (error) throw createError({ statusCode: 500, message: error.message })

  const used = new Set((data ?? []).map(row => row.code).filter(Boolean))
  let next = (data ?? []).reduce((max, row) => {
    if (!row.code?.startsWith(`${prefix}-`)) return max
    const seq = Number(row.code.slice(prefix.length + 1))
    return Number.isFinite(seq) && seq > max ? seq : max
  }, 0) + 1

  while (used.has(`${prefix}-${String(next).padStart(4, '0')}`)) next++
  return `${prefix}-${String(next).padStart(4, '0')}`
}

async function loadActiveAssignments(event: H3Event): Promise<Map<string, TenantAssignment>> {
  const client = await serverSupabaseClient(event)
  const { data: contracts, error: contractError } = await client
    .from('contracts')
    .select('id, tenant_id, room_id, building_id, rooms(room_number, buildings(name, slug))')
    .eq('status', 'active')

  if (contractError) throw createError({ statusCode: 500, message: contractError.message })

  const assignments = new Map<string, TenantAssignment>()
  const activeContracts = contracts ?? []
  for (const contract of activeContracts) {
    const room = contract.rooms as { room_number?: string | null; buildings?: { name?: string | null; slug?: string | null } | null } | null
    assignments.set(contract.tenant_id, {
      contractId: contract.id,
      roomId: contract.room_id,
      roomNumber: room?.room_number ?? '',
      buildingId: contract.building_id,
      buildingName: room?.buildings?.name ?? '',
      buildingSlug: room?.buildings?.slug ?? null,
    })
  }

  if (activeContracts.length === 0) return assignments

  const { data: occupants, error: occupantError } = await client
    .from('contract_occupants')
    .select('tenant_id, contract_id')
    .is('move_out_date', null)
    .in('contract_id', activeContracts.map(contract => contract.id))

  if (occupantError) throw createError({ statusCode: 500, message: occupantError.message })

  const contractById = new Map(activeContracts.map(contract => [contract.id, contract]))
  for (const occupant of occupants ?? []) {
    const contract = contractById.get(occupant.contract_id)
    if (!contract || assignments.has(occupant.tenant_id)) continue
    const room = contract.rooms as { room_number?: string | null; buildings?: { name?: string | null; slug?: string | null } | null } | null
    assignments.set(occupant.tenant_id, {
      contractId: contract.id,
      roomId: contract.room_id,
      roomNumber: room?.room_number ?? '',
      buildingId: contract.building_id,
      buildingName: room?.buildings?.name ?? '',
      buildingSlug: room?.buildings?.slug ?? null,
    })
  }

  return assignments
}

async function findTenantIdsForBuildings(event: H3Event, buildingIds: string[]): Promise<string[]> {
  if (buildingIds.length === 0) return []

  const client = await serverSupabaseClient(event)
  const { data: contracts, error: contractError } = await client
    .from('contracts')
    .select('id, tenant_id')
    .in('building_id', buildingIds)

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

  return [...new Set([...primaryTenantIds, ...occupantTenantIds])]
}

export const TenantRepository = {
  async findAll(
    event: H3Event,
    filters: TenantFilters = {},
  ): Promise<{ items: Tenant[]; total: number }> {
    if (filters.buildingIds && filters.buildingIds.length === 0) {
      return { items: [], total: 0 }
    }

    const client = await serverSupabaseClient(event)
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1
    const sort = filters.sort ?? 'full_name'
    const order = filters.order ?? 'asc'
    const ascending = order === 'asc'

    let query = client
      .from('tenants')
      .select('*', { count: 'exact' })
      .order(sort, { ascending })
      .range(from, to)

    const activeAssignments = await loadActiveAssignments(event)
    const occupiedIds = [...activeAssignments.keys()]

    const effectiveBuildingIds = filters.building_id
      ? [filters.building_id]
      : filters.buildingIds

    if (effectiveBuildingIds) {
      const tenantIds = await findTenantIdsForBuildings(event, effectiveBuildingIds)
      if (tenantIds.length === 0) {
        return { items: [], total: 0 }
      }

      query = query.in('id', tenantIds)
    }

    if (filters.q) {
      const term = filters.q.trim().replace(/[,()]/g, '')
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,id_number.ilike.%${term}%,code.ilike.%${term}%`,
      )
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    else {
      query = query.neq('status', 'archived')
    }

    if (filters.contract_state === 'with_contract') {
      if (occupiedIds.length === 0) return { items: [], total: 0 }
      query = query.in('id', occupiedIds)
    }
    else if (filters.contract_state === 'without_contract' && occupiedIds.length > 0) {
      query = query.not('id', 'in', `(${occupiedIds.join(',')})`)
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
    return {
      items: (data ?? []).map((row) => {
        const tenant = mapTenant(row)
        const activeAssignment = activeAssignments.get(tenant.id) ?? null
        return {
          ...tenant,
          hasActiveContract: Boolean(activeAssignment),
          activeAssignment,
        }
      }),
      total: count ?? 0,
    }
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

  async hasContractInBuildings(
    event: H3Event,
    tenantId: string,
    buildingIds: string[],
  ): Promise<boolean> {
    const tenantIds = await findTenantIdsForBuildings(event, buildingIds)
    return tenantIds.includes(tenantId)
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
    const createdAt = new Date().toISOString()
    const code = await buildUniqueTenantCode(event, input.full_name, createdAt)
    const { data, error } = await client
      .from('tenants')
      .insert({
        code,
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

  async findByIdentifier(event: H3Event, identifier: string): Promise<Tenant | null> {
    const client = await serverSupabaseClient(event)
    const column = isUuid(identifier) ? 'id' : 'code'
    const { data, error } = await client
      .from('tenants')
      .select('*')
      .eq(column, identifier)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapTenant(data) : null
  },

  async countActiveContractsForTenant(event: H3Event, tenantId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { count, error } = await client
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
    if (error) throw createError({ statusCode: 500, message: error.message })
    return count ?? 0
  },

  async countActiveOccupanciesForTenant(event: H3Event, tenantId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { count, error } = await client
      .from('contract_occupants')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('move_out_date', null)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return count ?? 0
  },

  async softArchive(event: H3Event, id: string): Promise<Tenant> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('tenants')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapTenant(data)
  },

  async setStatus(event: H3Event, id: string, status: TenantStatus): Promise<Tenant> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('tenants')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapTenant(data)
  },
}
