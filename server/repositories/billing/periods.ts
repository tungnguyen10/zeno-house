import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { BillingPeriod, BillingPeriodListFilters } from '~/types/billing'
import type { BillingPeriodStatus } from '~/utils/constants/billing'
import { mapBillingPeriod } from '~/utils/mappers/billing'

export const BillingPeriodRepository = {
  async findManyByIds(event: H3Event, ids: string[]): Promise<BillingPeriod[]> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .in('id', unique)
    if (error) throwDbError(error, 'billing.periods.findManyByIds')
    return (data ?? []).map(mapBillingPeriod)
  },
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
    if (error) throwDbError(error, 'billing.periods.list')
    return (data ?? []).map(mapBillingPeriod)
  },

  async findById(event: H3Event, id: string): Promise<BillingPeriod | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throwDbError(error, 'billing.periods.findById')
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
    if (error) throwDbError(error, 'billing.periods.findByBuildingPeriod')
    return data ? mapBillingPeriod(data) : null
  },

  async findByBuildingPeriods(
    event: H3Event,
    keys: Array<{ buildingId: string; periodYear: number; periodMonth: number }>,
  ): Promise<Map<string, BillingPeriod>> {
    if (keys.length === 0) return new Map()
    const buildingIds = [...new Set(keys.map(key => key.buildingId))]
    const periodYears = [...new Set(keys.map(key => key.periodYear))]
    const periodMonths = [...new Set(keys.map(key => key.periodMonth))]
    const requested = new Set(keys.map(key => `${key.buildingId}:${key.periodYear}:${key.periodMonth}`))
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('*')
      .in('building_id', buildingIds)
      .in('period_year', periodYears)
      .in('period_month', periodMonths)
    if (error) throwDbError(error, 'billing.periods.findByBuildingPeriods')
    const periods = (data ?? []).map(mapBillingPeriod)
    return new Map(periods
      .filter(period => requested.has(`${period.buildingId}:${period.periodYear}:${period.periodMonth}`))
      .map(period => [`${period.buildingId}:${period.periodYear}:${period.periodMonth}`, period]))
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
    if (error) throwDbError(error, 'billing.periods.insert')
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
    if (error) throwDbError(error, 'billing.periods.updateStatus')
    return mapBillingPeriod(data)
  },
}
