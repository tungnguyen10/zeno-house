import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingPeriod } from '~/types/billing'
import { mapBillingPeriod } from '~/utils/mappers/billing'

export const BillingPeriodRepository = {
  async findByBuilding(event: H3Event, buildingId: string): Promise<BillingPeriod[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .eq('building_id', buildingId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingPeriod)
  },

  async findByPeriod(
    event: H3Event,
    buildingId: string,
    year: number,
    month: number,
  ): Promise<BillingPeriod | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .eq('building_id', buildingId)
      .eq('period_year', year)
      .eq('period_month', month)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingPeriod(data) : null
  },

  async findById(event: H3Event, id: string): Promise<BillingPeriod | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingPeriod(data) : null
  },

  async create(
    event: H3Event,
    input: { building_id: string; period_year: number; period_month: number },
  ): Promise<BillingPeriod> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .insert(input)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingPeriod(data)
  },

  async update(
    event: H3Event,
    id: string,
    input: { status?: string; finalized_at?: string | null; finalized_by?: string | null },
  ): Promise<BillingPeriod> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingPeriod(data)
  },

  async findAllSummary(
    event: H3Event,
    filters: { buildingId?: string; year?: number },
  ): Promise<Array<{
    id: string
    buildingId: string
    buildingName: string
    periodYear: number
    periodMonth: number
    status: string
    itemCount: number
    paidCount: number
    totalAmount: number
  }>> {
    const client = await serverSupabaseClient(event)

    let query = client
      .from('billing_periods')
      .select(`
        id, building_id, period_year, period_month, status, finalized_at,
        buildings!inner(name),
        billing_runs(id, item_count, total_amount,
          billing_items(payment_status)
        )
      `)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })

    if (filters.buildingId) {
      query = query.eq('building_id', filters.buildingId)
    }
    if (filters.year) {
      query = query.eq('period_year', filters.year)
    }

    const { data, error } = await query

    if (error) throw createError({ statusCode: 500, message: error.message })

    return (data ?? []).map((row: any) => {
      const run = row.billing_runs?.[0]
      const items = run?.billing_items ?? []
      const paidCount = items.filter((i: any) => i.payment_status === 'paid').length

      return {
        id: row.id,
        buildingId: row.building_id,
        buildingName: row.buildings?.name ?? '',
        periodYear: row.period_year,
        periodMonth: row.period_month,
        status: row.status,
        itemCount: run?.item_count ?? 0,
        paidCount,
        totalAmount: run?.total_amount ?? 0,
      }
    })
  },
}
