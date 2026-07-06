import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { ServiceCatalogItem } from '~/types/service-catalog'
import type { ServiceCatalogCreateInput } from '~/utils/validators/service-catalog'
import { mapServiceCatalog } from '~/utils/mappers/service-catalog'
import { slugifyName } from '~/utils/format/slug'

export const ServiceCatalogRepository = {
  async findAll(event: H3Event, buildingId?: string): Promise<ServiceCatalogItem[]> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('service_catalog')
      .select('*')
      .eq('is_active', true)

    if (buildingId) {
      query = query.or(`building_id.is.null,building_id.eq.${buildingId}`)
    }
    else {
      query = query.is('building_id', null)
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapServiceCatalog)
  },

  async findCustomByName(event: H3Event, buildingId: string, name: string): Promise<ServiceCatalogItem | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('service_catalog')
      .select('*')
      .filter('building_id', 'eq', buildingId)
      .eq('name', name)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapServiceCatalog(data) : null
  },

  async nextSortOrder(event: H3Event, buildingId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('service_catalog')
      .select('sort_order')
      .or(`building_id.is.null,building_id.eq.${buildingId}`)
      .order('sort_order', { ascending: false })
      .limit(1)

    if (error) throw createError({ statusCode: 500, message: error.message })
    return Number(data?.[0]?.sort_order ?? 0) + 1
  },

  async createCustom(
    event: H3Event,
    input: ServiceCatalogCreateInput & { building_id: string, sort_order: number },
  ): Promise<ServiceCatalogItem> {
    const client = await serverSupabaseClient(event)
    const codeBase = slugifyName(input.name) || 'dich-vu'
    const code = `custom-${input.building_id.slice(0, 8)}-${codeBase}-${Date.now().toString(36)}`
    const { data, error } = await client
      .from('service_catalog')
      .insert({
        building_id: input.building_id,
        code,
        name: input.name,
        pricing_type: input.pricing_type,
        unit: input.unit || null,
        description: input.description || null,
        is_active: true,
        sort_order: input.sort_order,
      } as never)
      .select('*')
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapServiceCatalog(data)
  },
}
