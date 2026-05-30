import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { ServiceCatalogItem } from '~/types/service-catalog'
import { mapServiceCatalog } from '~/utils/mappers/service-catalog'

export const ServiceCatalogRepository = {
  async findAll(event: H3Event): Promise<ServiceCatalogItem[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('service_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapServiceCatalog)
  },
}
