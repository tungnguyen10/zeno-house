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
