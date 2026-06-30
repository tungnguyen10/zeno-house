import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BuildingService } from '~/types/building-services'
import type { BuildingServiceUpsertInput, BuildingServiceUpdateInput } from '~/utils/validators/building-services'
import { mapBuildingService } from '~/utils/mappers/building-services'

export const BuildingServiceRepository = {
  async findById(event: H3Event, id: string): Promise<BuildingService | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_services')
      .select('*, service_catalog(*)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBuildingService(data as Parameters<typeof mapBuildingService>[0]) : null
  },

  async findByBuilding(event: H3Event, buildingId: string): Promise<BuildingService[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_services')
      .select('*, service_catalog(*)')
      .eq('building_id', buildingId)
      .order('sort_order', { ascending: true })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(row => mapBuildingService(row as Parameters<typeof mapBuildingService>[0]))
  },

  async upsert(
    event: H3Event,
    input: BuildingServiceUpsertInput,
  ): Promise<BuildingService> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_services')
      .upsert({
        building_id: input.building_id,
        catalog_id: input.catalog_id,
        default_amount: input.default_amount ?? 0,
        is_active: input.is_active ?? false,
        sort_order: input.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'building_id,catalog_id' })
      .select('*, service_catalog(*)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBuildingService(data as Parameters<typeof mapBuildingService>[0])
  },

  async update(
    event: H3Event,
    id: string,
    input: BuildingServiceUpdateInput,
  ): Promise<BuildingService> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_services')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, service_catalog(*)')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) throw createError({ statusCode: 404, message: 'Không tìm thấy' })
    return mapBuildingService(data as Parameters<typeof mapBuildingService>[0])
  },
}
