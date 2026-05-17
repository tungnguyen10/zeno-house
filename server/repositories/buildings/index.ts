import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Building } from '~/types/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { mapBuilding, type BuildingRow } from '~/utils/mappers/buildings'

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
    return { items: (data as BuildingRow[] ?? []).map(mapBuilding), total: count ?? 0 }
  },

  async findById(event: H3Event, id: string): Promise<Building | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('*, rooms(count)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBuilding(data as BuildingRow) : null
  },

  async insert(event: H3Event, input: BuildingCreateInput): Promise<Building> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .insert({
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
        default_service_fees: input.default_service_fees ?? null,
        meter_reading_day: input.meter_reading_day ?? null,
        billing_generation_day: input.billing_generation_day ?? null,
        payment_due_day: input.payment_due_day ?? null,
        grace_period_days: input.grace_period_days ?? 0,
      })
      .select('*, rooms(count)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBuilding(data as BuildingRow)
  },

  async update(event: H3Event, id: string, input: BuildingUpdateInput): Promise<Building> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .update({
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
        ...(input.default_service_fees !== undefined && { default_service_fees: input.default_service_fees }),
        ...(input.meter_reading_day !== undefined && { meter_reading_day: input.meter_reading_day }),
        ...(input.billing_generation_day !== undefined && { billing_generation_day: input.billing_generation_day }),
        ...(input.payment_due_day !== undefined && { payment_due_day: input.payment_due_day }),
        ...(input.grace_period_days !== undefined && { grace_period_days: input.grace_period_days }),
      })
      .eq('id', id)
      .select('*, rooms(count)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBuilding(data as BuildingRow)
  },

  async remove(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('buildings').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
