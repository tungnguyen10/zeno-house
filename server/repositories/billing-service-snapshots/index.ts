import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingServiceSnapshot } from '~/types/billing'
import { mapBillingServiceSnapshot } from '~/utils/mappers/billing'

export const BillingServiceSnapshotRepository = {
  async bulkCreate(
    event: H3Event,
    snapshots: {
      billing_item_id: string
      catalog_id: string | null
      service_name: string
      pricing_type: string
      amount: number
      quantity: number
      total: number
    }[],
  ): Promise<void> {
    if (snapshots.length === 0) return
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('billing_service_snapshots').insert(snapshots)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async findByItemId(event: H3Event, billingItemId: string): Promise<BillingServiceSnapshot[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_service_snapshots')
      .select('*')
      .eq('billing_item_id', billingItemId)
      .order('service_name', { ascending: true })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingServiceSnapshot)
  },
}
