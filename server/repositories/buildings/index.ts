import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Building, BuildingServiceSummary } from '~/types/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { mapBuilding, type BuildingRow } from '~/utils/mappers/buildings'
import { isUuid, slugifyName } from '~/utils/format/slug'

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
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data || data.length === 0) return candidate

    candidate = `${baseSlug}-${suffix}`
    suffix++
  }
}

async function loadServiceSummaries(
  event: H3Event,
  buildingIds: string[],
): Promise<Map<string, BuildingServiceSummary>> {
  if (buildingIds.length === 0) return new Map()
  const client = await serverSupabaseClient(event)
  const { data, error } = await client
    .from('building_services')
    .select('building_id, is_active, service_catalog(name)')
    .in('building_id', buildingIds)

  if (error) throw createError({ statusCode: 500, message: error.message })

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
    opts: { page: number; limit: number },
  ): Promise<{ items: Building[]; total: number }> {
    const client = await serverSupabaseClient(event)
    const from = (opts.page - 1) * opts.limit
    const to = from + opts.limit - 1

    const { data, error, count } = await client
      .from('buildings')
      .select('*, rooms(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw createError({ statusCode: 500, message: error.message })
    const items = (data as BuildingRow[] ?? []).map(mapBuilding)
    return { items: await attachServiceSummaries(event, items), total: count ?? 0 }
  },

  async findById(event: H3Event, id: string): Promise<Building | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('*, rooms(count)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return null
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building ?? null
  },

  async findByIdentifier(event: H3Event, identifier: string): Promise<Building | null> {
    const client = await serverSupabaseClient(event)
    const column = isUuid(identifier) ? 'id' : 'slug'
    const { data, error } = await client
      .from('buildings')
      .select('*, rooms(count)')
      .eq(column, identifier)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return null
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building ?? null
  },

  async insert(event: H3Event, input: BuildingCreateInput): Promise<Building> {
    const client = await serverSupabaseClient(event)
    const slug = await buildUniqueSlug(event, input.slug ?? input.name)
    const { data, error } = await client
      .from('buildings')
      .insert({
        slug,
        name: input.name,
        address: input.address,
        description: input.description ?? null,
        status: input.status ?? 'active',
        owner_name: input.owner_name ?? null,
        owner_phone: input.owner_phone ?? null,
        owner_email: input.owner_email ?? null,
        electricity_pricing_type: input.electricity_pricing_type ?? 'per_kwh',
        default_electricity_rate: input.default_electricity_rate ?? null,
        water_pricing_type: input.water_pricing_type ?? 'per_m3',
        default_water_rate: input.default_water_rate ?? null,
        meter_reading_day: input.meter_reading_day ?? null,
        billing_generation_day: input.billing_generation_day ?? null,
        payment_due_day: input.payment_due_day ?? null,
        grace_period_days: input.grace_period_days ?? 0,
      })
      .select('*, rooms(count)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building!
  },

  async update(event: H3Event, id: string, input: BuildingUpdateInput): Promise<Building> {
    const client = await serverSupabaseClient(event)
    const slug = input.slug
      ? await buildUniqueSlug(event, input.slug, id)
      : input.name
        ? await buildUniqueSlug(event, input.name, id)
        : undefined
    const { data, error } = await client
      .from('buildings')
      .update({
        ...(slug !== undefined && { slug }),
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
      })
      .eq('id', id)
      .select('*, rooms(count)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    const [building] = await attachServiceSummaries(event, [mapBuilding(data as BuildingRow)])
    return building!
  },

  async remove(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('buildings').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
