import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingItem, BillingItemSummary, BillingPaymentStatus } from '~/types/billing'
import { mapBillingItem } from '~/utils/mappers/billing'

export interface BillingItemFilters {
  payment_status?: BillingPaymentStatus
  q?: string
  room_id?: string
}

export const BillingItemRepository = {
  async findByRun(
    event: H3Event,
    billingRunId: string | null,
    filters: BillingItemFilters = {},
  ): Promise<BillingItemSummary[]> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('billing_items')
      .select(`
        *,
        rooms!inner(id, room_number, floor),
        tenants!inner(id, full_name, phone)
      `)
      .order('rooms(room_number)', { ascending: true })

    if (billingRunId) query = query.eq('billing_run_id', billingRunId)

    if (filters.payment_status) query = query.eq('payment_status', filters.payment_status)
    if (filters.room_id) query = query.eq('room_id', filters.room_id)
    if (filters.q) {
      query = query.or(
        `rooms.room_number.ilike.%${filters.q}%,tenants.full_name.ilike.%${filters.q}%`,
      )
    }

    const { data, error } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })

    return (data ?? []).map((row: any) => ({
      ...mapBillingItem(row),
      room: { id: row.rooms.id, roomNumber: row.rooms.room_number, floor: row.rooms.floor },
      tenant: { id: row.tenants.id, fullName: row.tenants.full_name, phone: row.tenants.phone },
    }))
  },

  async findById(event: H3Event, id: string): Promise<BillingItem | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_items')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingItem(data) : null
  },

  async bulkCreate(
    event: H3Event,
    items: {
      billing_run_id: string
      room_id: string
      contract_id: string
      tenant_id: string
      rent_amount: number
      service_amount: number
      electricity_amount: number
      water_amount: number
      utility_amount: number
      total_amount: number
    }[],
  ): Promise<BillingItem[]> {
    if (items.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_items')
      .insert(items)
      .select()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingItem)
  },

  async bulkUpdatePaymentStatus(
    event: H3Event,
    ids: string[],
    status: BillingPaymentStatus,
    meta: {
      paid_by?: string
      payment_method?: string | null
      payment_note?: string | null
    },
  ): Promise<void> {
    const client = await serverSupabaseClient(event)
    const updateData =
      status === 'paid'
        ? {
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            paid_by: meta.paid_by ?? null,
            payment_method: meta.payment_method ?? null,
            payment_note: meta.payment_note ?? null,
          }
        : {
            payment_status: 'unpaid',
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
          }

    const { error } = await client
      .from('billing_items')
      .update(updateData)
      .in('id', ids)

    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async countPaidByRunId(event: H3Event, billingRunId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { count, error } = await client
      .from('billing_items')
      .select('*', { count: 'exact', head: true })
      .eq('billing_run_id', billingRunId)
      .eq('payment_status', 'paid')

    if (error) throw createError({ statusCode: 500, message: error.message })
    return count ?? 0
  },
}
