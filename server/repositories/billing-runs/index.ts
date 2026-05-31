import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingRun } from '~/types/billing'
import { mapBillingRun } from '~/utils/mappers/billing'

export const BillingRunRepository = {
  async findByPeriod(event: H3Event, billingPeriodId: string): Promise<BillingRun | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_runs')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingRun(data) : null
  },

  async findById(event: H3Event, id: string): Promise<BillingRun | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingRun(data) : null
  },

  async create(
    event: H3Event,
    input: {
      billing_period_id: string
      building_id: string
      generated_by: string
      item_count: number
      total_amount: number
    },
  ): Promise<BillingRun> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_runs')
      .insert({
        billing_period_id: input.billing_period_id,
        building_id: input.building_id,
        status: 'generated',
        schema_version: 1,
        generated_at: new Date().toISOString(),
        generated_by: input.generated_by,
        item_count: input.item_count,
        total_amount: input.total_amount,
      })
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingRun(data)
  },

  async update(
    event: H3Event,
    id: string,
    input: { status?: string; item_count?: number; total_amount?: number },
  ): Promise<BillingRun> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_runs')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingRun(data)
  },

  async deleteById(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('billing_runs')
      .delete()
      .eq('id', id)

    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
