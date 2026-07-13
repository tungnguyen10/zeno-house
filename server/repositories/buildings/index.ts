import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Building, BuildingServiceSummary } from '~/types/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { mapBuilding, type BuildingRow } from '~/utils/mappers/buildings'
import { isUuid, slugifyName } from '~/utils/format/slug'
import { buildingCodeFromSlug } from '~/utils/format/codes'

async function buildUniqueSlug(
  event: H3Event,
  name: string,
  excludeId?: string,
): Promise<string> {
  const client = await serverSupabaseClient(event)
  const baseSlug = slugifyName(name) || 'building'
  let candidate = baseSlug
  let suffix = 2

  while (true) {
    let query = client
      .from('buildings')
      .select('id')
      .eq('slug', candidate)
      .limit(1)

    if (excludeId) query = query.neq('id', excludeId)

    const { data, error } = await query
    if (error) throwDbError(error, 'buildings.buildUniqueSlug')
    if (!data || data.length === 0) return candidate

    candidate = `${baseSlug}-${suffix}`
    suffix++
  }
}

async function buildUniqueCode(
  event: H3Event,
  slug: string,
  excludeId?: string,
): Promise<string> {
  const client = await serverSupabaseClient(event)
  const baseCode = buildingCodeFromSlug(slug) || 'b'
  let candidate = baseCode
  let suffix = 2

  while (true) {
    let query = client
      .from('buildings')
      .select('id')
      .eq('code', candidate)
      .limit(1)

    if (excludeId) query = query.neq('id', excludeId)

    const { data, error } = await query
    if (error) throwDbError(error, 'buildings.buildUniqueCode')
    if (!data || data.length === 0) return candidate

    candidate = `${baseCode}${suffix}`
    suffix++
  }
}

async function loadServiceSummaries(  event: H3Event,
  buildingIds: string[],
): Promise<Map<string, BuildingServiceSummary>> {
  if (buildingIds.length === 0) return new Map()
  const client = serverSupabaseClient(event)
  const { data, error } = await client
    .from('building_services')
    .select('building_id, is_active, service_catalog(name)')
    .in('building_id', buildingIds)

  if (error) throwDbError(error, 'buildings.loadServiceSummaries')

  const summaries = new Map<string, BuildingServiceSummary>()
  for (const buildingId of buildingIds) {
    summaries.set(buildingId, { totalCount: 0, activeCount: 0, activeNames: [] })
  }

  for (const row of data ?? []) {
    const summary = summaries.get(row.building_id)
    if (!summary) continue
    summary.totalCount++
    if (row.is_active) {
      summary.activeCount++
      const catalog = row.service_catalog as { name?: string | null } | null
      if (catalog?.name) summary.activeNames.push(catalog.name)
    }
  }

  return summaries
}

async function attachServiceSummaries(event: H3Event, buildings: Building[]): Promise<Building[]> {
  const summaries = await loadServiceSummaries(event, buildings.map(building => building.id))
  return buildings.map(building => ({
    ...building,
    serviceSummary: summaries.get(building.id) ?? building.serviceSummary,
  }))
}

export const BuildingRepository = {
  async findAll(
    event: H3Event,
    opts: {
      page: number
      limit: number
      q?: string
      status?: ('active' | 'inactive')[]
      sort?: 'name' | 'created_at' | 'total_rooms'
      order?: 'asc' | 'desc'
      buildingIds?: string[] | null
    },
  ): Promise<{ items: Building[]; total: number }> {
    if (opts.buildingIds && opts.buildingIds.length === 0) {
      return { items: [], total: 0 }
    }

    // Reads are filtered by service-layer scope before reaching repository.
    const client = serverSupabaseClient(event)
    const sort = opts.sort ?? 'created_at'
    const order = opts.order ?? 'desc'
    const ascending = order === 'asc'

    if (sort === 'total_rooms') {
      // Computed aggregate cannot be ordered by Postgres directly via PostgREST;
      // fetch matching rows, sort in memory, then paginate. Buildings table is
      // small (see design D6), so this is acceptable.
      let query = client
        .from('buildings')
        .select('*, rooms(count)', { count: 'exact' })

      if (opts.q && opts.q.trim()) {
        const term = opts.q.trim().replace(/[,()]/g, '')
        query = query.or(
          `name.ilike.%${term}%,address.ilike.%${term}%,code.ilike.%${term}%`,
        )
      }
      if (opts.status && opts.status.length > 0) {
        query = query.in('status', opts.status)
      }
      if (opts.buildingIds) {
        query = query.in('id', opts.buildingIds)
      }

      const { data, error, count } = await query
      if (error) throwDbError(error, 'buildings.findAll')

      const rows = (data as BuildingRow[] ?? []).map(mapBuilding)
      rows.sort((a, b) => (ascending ? a.totalRooms - b.totalRooms : b.totalRooms - a.totalRooms))

      const from = (opts.page - 1) * opts.limit
      const slice = rows.slice(from, from + opts.limit)
      return { items: await attachServiceSummaries(event, slice), total: count ?? rows.length }
    }

    const from = (opts.page - 1) * opts.limit
    const to = from + opts.limit - 1

    let query = client
      .from('buildings')
      .select('*, rooms(count)', { count: 'exact' })

    if (opts.q && opts.q.trim()) {
      const term = opts.q.trim().replace(/[,()]/g, '')
      query = query.or(
        `name.ilike.%${term}%,address.ilike.%${term}%,code.ilike.%${term}%`,
      )
    }
    if (opts.status && opts.status.length > 0) {
      query = query.in('status', opts.status)
    }
    if (opts.buildingIds) {
      query = query.in('id', opts.buildingIds)
    }

    query = query.order(sort, { ascending }).range(from, to)

    const { data, error, count } = await query
    if (error) throwDbError(error, 'buildings.findAll')
    const items = (data as BuildingRow[] ?? []).map(mapBuilding)
    return { items: await attachServiceSummaries(event, items), total: count ?? 0 }
  },

  async findById(event: H3Event, id: string): Promise<Building | null> {
    // Reads are filtered by service-layer scope before reaching repository.
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('*, rooms(count)')
      .eq('id', id)
      .maybeSingle()

    if (error) throwDbError(error, 'buildings.findById')
    if (!data) return null
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building ?? null
  },

  async findByIdentifier(event: H3Event, identifier: string): Promise<Building | null> {
    // Reads are filtered by service-layer scope before reaching repository.
    const client = serverSupabaseClient(event)
    const column = isUuid(identifier) ? 'id' : 'slug'
    const { data, error } = await client
      .from('buildings')
      .select('*, rooms(count)')
      .eq(column, identifier)
      .maybeSingle()

    if (error) throwDbError(error, 'buildings.findByIdentifier')
    if (!data) return null
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building ?? null
  },

  async insert(
    event: H3Event,
    input: BuildingCreateInput,
    provenance: { created_by?: string | null; owner_user_id?: string | null } = {},
  ): Promise<Building> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (capability + building scope checks) to avoid RLS drift issues.
    const client = serverSupabaseClient(event)
    const slug = await buildUniqueSlug(event, input.slug ?? input.name)
    const code = await buildUniqueCode(event, slug)
    const insertPayload = {
      slug,
      code,
      name: input.name,
      address: input.address,
      description: input.description ?? null,
      status: input.status ?? 'active',
      owner_name: input.owner_name ?? null,
      owner_phone: input.owner_phone ?? null,
      owner_email: input.owner_email ?? null,
      created_by: provenance.created_by ?? null,
      owner_user_id: provenance.owner_user_id ?? null,
      electricity_pricing_type: input.electricity_pricing_type ?? 'per_kwh',
      default_electricity_rate: input.default_electricity_rate ?? null,
      water_pricing_type: input.water_pricing_type ?? 'per_m3',
      default_water_rate: input.default_water_rate ?? null,
      meter_reading_day: input.meter_reading_day ?? null,
      billing_generation_day: input.billing_generation_day ?? null,
      payment_due_day: input.payment_due_day ?? null,
      grace_period_days: input.grace_period_days ?? 0,
      operational_start_year: input.operational_start_year ?? null,
      operational_start_month: input.operational_start_month ?? null,
    }
    const { data, error } = await client
      .from('buildings')
      .insert(insertPayload as never)
      .select('*, rooms(count)')
      .single()

    if (error) throwDbError(error, 'buildings.insert')
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building!
  },

  async update(event: H3Event, id: string, input: BuildingUpdateInput): Promise<Building> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (capability + building scope checks) to avoid RLS drift issues.
    const client = serverSupabaseClient(event)
    const slug = input.slug
      ? await buildUniqueSlug(event, input.slug, id)
      : undefined

    // Check code lock: reject if building already has rooms
    let newCode: string | undefined
    if (input.code !== undefined) {
      const { data: roomsCheck, error: roomsError } = await client
        .from('rooms')
        .select('id')
        .eq('building_id', id)
        .limit(1)
      if (roomsError) throwDbError(roomsError, 'buildings.update.roomsCheck')
      if (roomsCheck && roomsCheck.length > 0) {
        throwConflict('Building code cannot be changed after rooms have been created')
      }
      newCode = await buildUniqueCode(event, input.code, id)
    }

    const updatePayload = {
      ...(slug !== undefined && { slug }),
      ...(newCode !== undefined && { code: newCode }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.owner_name !== undefined && { owner_name: input.owner_name }),
      ...(input.owner_phone !== undefined && { owner_phone: input.owner_phone }),
      ...(input.owner_email !== undefined && { owner_email: input.owner_email }),
      ...(input.electricity_pricing_type !== undefined && { electricity_pricing_type: input.electricity_pricing_type }),
      ...(input.default_electricity_rate !== undefined && { default_electricity_rate: input.default_electricity_rate }),
      ...(input.water_pricing_type !== undefined && { water_pricing_type: input.water_pricing_type }),
      ...(input.default_water_rate !== undefined && { default_water_rate: input.default_water_rate }),
      ...(input.meter_reading_day !== undefined && { meter_reading_day: input.meter_reading_day }),
      ...(input.billing_generation_day !== undefined && { billing_generation_day: input.billing_generation_day }),
      ...(input.payment_due_day !== undefined && { payment_due_day: input.payment_due_day }),
      ...(input.grace_period_days !== undefined && { grace_period_days: input.grace_period_days }),
      ...(input.operational_start_year !== undefined && { operational_start_year: input.operational_start_year }),
      ...(input.operational_start_month !== undefined && { operational_start_month: input.operational_start_month }),
    }

    const { data, error } = await client
      .from('buildings')
      .update(updatePayload as never)
      .eq('id', id)
      .select('*, rooms(count)')
      .single()

    if (error) throwDbError(error, 'buildings.update')
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building!
  },

  async remove(event: H3Event, id: string): Promise<void> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (capability + building scope checks) to avoid RLS drift issues.
    const client = serverSupabaseClient(event)
    const { error } = await client.from('buildings').delete().eq('id', id)
    if (error) throwDbError(error, 'buildings.remove')
  },

  async countRoomsForBuilding(event: H3Event, buildingId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { count, error } = await client
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
    if (error) throwDbError(error, 'buildings.countRoomsForBuilding')
    return count ?? 0
  },

  async countActiveContractsForBuilding(event: H3Event, buildingId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { count, error } = await client
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
      .eq('status', 'active')
    if (error) throwDbError(error, 'buildings.countActiveContractsForBuilding')
    return count ?? 0
  },

  async softArchive(event: H3Event, id: string): Promise<Building> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (capability + building scope checks) to avoid RLS drift issues.
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('*, rooms(count)')
      .single()

    if (error) throwDbError(error, 'buildings.softArchive')
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building!
  },
}
