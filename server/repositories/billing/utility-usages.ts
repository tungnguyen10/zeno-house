import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { BillingUtilityUsage } from '~/types/billing'
import type { MeterType } from '~/utils/constants/billing'
import { mapBillingUtilityUsage } from '~/utils/mappers/billing'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'

type UtilityUsageApprovalUpdate = {
  approved_by: string
  approved_at: string
  updated_at: string
}

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
    if (error) throwDbError(error, 'billing.utilityUsages.listByPeriod')
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
    if (error) throwDbError(error, 'billing.utilityUsages.findByPeriodRoomMeter')
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
    if (error) throwDbError(error, 'billing.utilityUsages.upsert')
    return mapBillingUtilityUsage(data)
  },

  async findById(event: H3Event, billingPeriodId: string, overrideId: string): Promise<BillingUtilityUsage | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_utility_usages')
      .select('*')
      .eq('id', overrideId)
      .eq('billing_period_id', billingPeriodId)
      .maybeSingle()
    if (error) throwDbError(error, 'billing.utilityUsages.findById')
    return data ? mapBillingUtilityUsage(data) : null
  },

  async deleteById(event: H3Event, overrideId: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('billing_utility_usages')
      .delete()
      .eq('id', overrideId)
    if (error) throwDbError(error, 'billing.utilityUsages.deleteById')
  },

  async approveById(
    event: H3Event,
    overrideId: string,
    approvedBy: string,
  ): Promise<BillingUtilityUsage> {
    const client = await serverSupabaseClient(event)
    const updatePayload: UtilityUsageApprovalUpdate = {
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
      .from('billing_utility_usages')
      // New columns are added by migration and may lag in generated DB types.
      .update(updatePayload as never)
      .eq('id', overrideId)
      .select()
      .single()
    if (error) throwDbError(error, 'billing.utilityUsages.approveById')
    return mapBillingUtilityUsage(data)
  },
}
