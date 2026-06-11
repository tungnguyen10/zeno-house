import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BillingUtilityUsage } from '~/types/billing'
import type { MeterType } from '~/utils/constants/billing'
import { mapBillingUtilityUsage } from '~/utils/mappers/billing'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'

export const BillingUtilityUsageRepository = {
  async listByPeriod(
    event: H3Event,
    billingPeriodId: string,
  ): Promise<BillingUtilityUsage[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_utility_usages')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBillingUtilityUsage)
  },

  async findByPeriodRoomMeter(
    event: H3Event,
    billingPeriodId: string,
    roomId: string,
    meterType: MeterType,
  ): Promise<BillingUtilityUsage | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_utility_usages')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .eq('room_id', roomId)
      .eq('meter_type', meterType)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBillingUtilityUsage(data) : null
  },

  async upsert(
    event: H3Event,
    billingPeriodId: string,
    createdBy: string | null,
    input: UtilityUsageOverrideInput,
  ): Promise<BillingUtilityUsage> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_utility_usages')
      .upsert(
        {
          billing_period_id: billingPeriodId,
          room_id: input.room_id,
          meter_type: input.meter_type,
          previous_reading_id: input.previous_reading_id ?? null,
          previous_reading_value: input.previous_reading_value,
          current_reading_id: input.current_reading_id ?? null,
          current_reading_value: input.current_reading_value,
          old_meter_final_value: input.old_meter_final_value ?? null,
          new_meter_start_value: input.new_meter_start_value ?? null,
          billable_usage: input.billable_usage,
          reason: input.reason,
          note: input.note ?? null,
          created_by: createdBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'billing_period_id,room_id,meter_type' },
      )
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBillingUtilityUsage(data)
  },
}
