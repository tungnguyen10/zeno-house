import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingUtilitySnapshot } from '~/types/billing'
import { mapBillingUtilitySnapshot } from '~/utils/mappers/billing'

export const BillingUtilitySnapshotRepository = {
  async bulkCreate(
    event: H3Event,
    snapshots: {
      billing_item_id: string
      meter_type: string
      old_reading: number | null
      new_reading: number | null
      consumption: number | null
      unit_price: number | null
      total: number
      is_adjusted: boolean
      adjustment_reason: string | null
    }[],
  ): Promise<void> {
    if (snapshots.length === 0) return
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('billing_utility_snapshots').insert(snapshots)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async findByItemId(event: H3Event, billingItemId: string): Promise<BillingUtilitySnapshot[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_utility_snapshots')
      .select('*')
      .eq('billing_item_id', billingItemId)
      .order('meter_type', { ascending: true })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingUtilitySnapshot)
  },
}
