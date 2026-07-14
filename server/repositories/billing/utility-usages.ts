import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { BillingUtilityUsage } from '~/types/billing'
import type { MeterType } from '~/utils/constants/billing'
import { mapBillingUtilityUsage } from '~/utils/mappers/billing'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'
import type { Tables } from '~/types/database.types'

type UtilityUsageApprovalUpdate = {
  approved_by: string
  approved_at: string
  updated_at: string
}

function utilityRpcMessage(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : ''
}

export function throwUtilityUsageRpcError(error: unknown): never {
  const message = utilityRpcMessage(error)
  if (message.includes('UTILITY_OVERRIDE_VERSION_CONFLICT')) {
    throwConflict('Điều chỉnh tiêu thụ đã thay đổi. Vui lòng tải lại dữ liệu.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('BILLING_PERIOD_LOCKED')) {
    throwConflict('Kỳ đã chốt, không thể điều chỉnh tiêu thụ.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('BILLING_INVOICE_LOCKED')) {
    throwConflict('Phòng đã có hóa đơn đang hiệu lực, không thể điều chỉnh tiêu thụ.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('UTILITY_OVERRIDE_')) throwValidationError('Dữ liệu điều chỉnh tiêu thụ không hợp lệ.')
  throwDbError(error, 'billing.utilityUsages.saveWithAudit')
}

export const BillingUtilityUsageRepository = {
  async saveWithAudit(
    event: H3Event,
    billingPeriodId: string,
    actorId: string,
    input: UtilityUsageOverrideInput,
    operation: {
      source: 'api' | 'ai'
      action_plan_id?: string | null
      idempotency_key?: string | null
    },
  ): Promise<BillingUtilityUsage> {
    const client = await serverSupabaseClient(event)
    const { expected_updated_at, ...override } = input
    const { data, error } = await client.rpc('save_utility_usage_override_with_audit', {
      p_billing_period_id: billingPeriodId,
      p_override: override,
      // PostgREST accepts SQL NULL here, but generated function args do not model
      // nullable parameters. A null value means this is the initial override.
      p_expected_updated_at: (expected_updated_at ?? null) as string,
      p_actor_id: actorId,
      p_source: operation.source,
      p_action_plan_id: operation.action_plan_id ?? undefined,
      p_idempotency_key: operation.idempotency_key ?? undefined,
    })
    if (error) throwUtilityUsageRpcError(error)
    const row = ((data ?? []) as unknown as Tables<'billing_utility_usages'>[])[0]
    if (!row) throwInternal(new Error('Empty utility override save result'), 'billing.utilityUsages.saveWithAudit')
    return mapBillingUtilityUsage(row)
  },

  async listByPeriods(
    event: H3Event,
    billingPeriodIds: string[],
  ): Promise<BillingUtilityUsage[]> {
    if (billingPeriodIds.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_utility_usages')
      .select('*')
      .in('billing_period_id', billingPeriodIds)
    if (error) throwDbError(error, 'billing.utilityUsages.listByPeriods')
    return (data ?? []).map(mapBillingUtilityUsage)
  },

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
      .update(updatePayload)
      .eq('id', overrideId)
      .select()
      .single()
    if (error) throwDbError(error, 'billing.utilityUsages.approveById')
    return mapBillingUtilityUsage(data)
  },
}
