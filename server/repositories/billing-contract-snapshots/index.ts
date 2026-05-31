import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingContractSnapshot } from '~/types/billing'
import { mapBillingContractSnapshot } from '~/utils/mappers/billing'

export const BillingContractSnapshotRepository = {
  async bulkCreate(
    event: H3Event,
    snapshots: {
      billing_item_id: string
      monthly_rent: number
      surcharge_amount: number
      discount_amount: number
      payment_day: number | null
      occupant_count: number
    }[],
  ): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('billing_contract_snapshots').insert(snapshots)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async findByItemId(event: H3Event, billingItemId: string): Promise<BillingContractSnapshot | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_contract_snapshots')
      .select('*')
      .eq('billing_item_id', billingItemId)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingContractSnapshot(data) : null
  },
}
