import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { BillingPeriod, BillingPeriodListFilters } from '~/types/billing'
import type { BillingPeriodStatus } from '~/utils/constants/billing'
import { mapBillingPeriod } from '~/utils/mappers/billing'

export const BillingPeriodRepository = {
  async list(event: H3Event, filters: BillingPeriodListFilters): Promise<BillingPeriod[]> {
    if (filters.buildingIds && filters.buildingIds.length === 0) return []

    const client = await serverSupabaseClient(event)
    let query = client
      .from('billing_periods')
      .select('*')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .order('building_id', { ascending: true })

    if (filters.building_id) query = query.eq('building_id', filters.building_id)
    else if (filters.buildingIds) query = query.in('building_id', filters.buildingIds)
    if (filters.period_year !== undefined) query = query.eq('period_year', filters.period_year)
    if (filters.period_month !== undefined) query = query.eq('period_month', filters.period_month)
    if (filters.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingPeriod)
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

  async findByBuildingPeriod(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<BillingPeriod | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .eq('building_id', buildingId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingPeriod(data) : null
  },

  async insert(
    event: H3Event,
    input: { building_id: string; period_year: number; period_month: number; opened_by: string | null },
  ): Promise<BillingPeriod> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .insert({
        building_id: input.building_id,
        period_year: input.period_year,
        period_month: input.period_month,
        opened_by: input.opened_by,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingPeriod(data)
  },

  async updateStatus(
    event: H3Event,
    id: string,
    status: BillingPeriodStatus,
    extras: { issued_at?: string | null; closed_at?: string | null } = {},
  ): Promise<BillingPeriod> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .update({
        status,
        ...(extras.issued_at !== undefined && { issued_at: extras.issued_at }),
        ...(extras.closed_at !== undefined && { closed_at: extras.closed_at }),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingPeriod(data)
  },
}
