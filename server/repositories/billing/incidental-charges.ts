import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { BillingIncidentalCharge } from '~/types/billing'
import type {
  IncidentalChargeCreateInput,
  IncidentalChargeUpdateInput,
} from '~/utils/validators/billing'
import {
  mapBillingIncidentalCharge,
  type BillingIncidentalChargeRow,
} from '~/utils/mappers/billing'
import { db as serverSupabaseClient } from '../../utils/db'

type IncidentalChargeDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      billing_incidental_charges: {
        Row: BillingIncidentalChargeRow
        Insert: never
        Update: never
        Relationships: []
      }
    }
  }
}

type RpcResult = PromiseLike<{ data: BillingIncidentalChargeRow[] | null; error: unknown }>
type IncidentalChargeRpc = (name: string, args: Record<string, unknown>) => RpcResult

function client(event: H3Event): SupabaseClient<IncidentalChargeDatabase> {
  return serverSupabaseClient(event) as unknown as SupabaseClient<IncidentalChargeDatabase>
}

function rpcMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message.toUpperCase() : ''
}

export function throwIncidentalChargeRpcError(error: unknown): never {
  const message = rpcMessage(error)
  if (message.includes('INCIDENTAL_CHARGE_VERSION_CONFLICT')) {
    throwConflict('Khoản phát sinh đã thay đổi. Vui lòng tải lại dữ liệu.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('BILLING_PERIOD_LOCKED')) {
    throwConflict('Kỳ đã chốt, không thể thay đổi khoản phát sinh.')
  }
  if (message.includes('BILLING_INVOICE_LOCKED')) {
    throwConflict('Phòng đã có hóa đơn hiệu lực. Hãy dùng luồng điều chỉnh hóa đơn.')
  }
  if (message.includes('INCIDENTAL_CHARGE_OPERATION_CONFLICT')) {
    throwConflict('Yêu cầu tạo khoản phát sinh đã được dùng với dữ liệu khác.')
  }
  if (message.includes('INCIDENTAL_CHARGE_NOT_FOUND') || message.includes('INCIDENTAL_CHARGE_CONTRACT_NOT_FOUND')) {
    throwNotFound('Không tìm thấy khoản phát sinh')
  }
  if (
    message.includes('INCIDENTAL_CHARGE_SCOPE_MISMATCH')
    || message.includes('INCIDENTAL_CHARGE_LABEL_INVALID')
    || message.includes('INCIDENTAL_CHARGE_AMOUNT_INVALID')
    || message.includes('INCIDENTAL_CHARGE_NOTE_INVALID')
  ) {
    throwValidationError('Dữ liệu khoản phát sinh không hợp lệ.')
  }
  throwDbError(error, 'billing.incidentalCharges.atomicOperation')
}

async function callRpc(
  event: H3Event,
  name: string,
  args: Record<string, unknown>,
): Promise<BillingIncidentalCharge> {
  const rpc = client(event).rpc as unknown as IncidentalChargeRpc
  const { data, error } = await rpc(name, args)
  if (error) throwIncidentalChargeRpcError(error)
  const row = data?.[0]
  if (!row) throwInternal(new Error(`Empty ${name} result`), 'billing.incidentalCharges.atomicOperation')
  return mapBillingIncidentalCharge(row)
}

export const BillingIncidentalChargeRepository = {
  async listByPeriod(event: H3Event, billingPeriodId: string): Promise<BillingIncidentalCharge[]> {
    const { data, error } = await client(event)
      .from('billing_incidental_charges')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (error) throwDbError(error, 'billing.incidentalCharges.listByPeriod')
    return (data ?? []).map(mapBillingIncidentalCharge)
  },

  async findById(event: H3Event, chargeId: string): Promise<BillingIncidentalCharge | null> {
    const { data, error } = await client(event)
      .from('billing_incidental_charges')
      .select('*')
      .eq('id', chargeId)
      .maybeSingle()
    if (error) throwDbError(error, 'billing.incidentalCharges.findById')
    return data ? mapBillingIncidentalCharge(data) : null
  },

  createWithAudit(
    event: H3Event,
    billingPeriodId: string,
    actorId: string,
    input: IncidentalChargeCreateInput,
  ): Promise<BillingIncidentalCharge> {
    return callRpc(event, 'create_billing_incidental_charge_with_audit', {
      p_billing_period_id: billingPeriodId,
      p_contract_id: input.contract_id,
      p_actor_id: actorId,
      p_label: input.label,
      p_amount: input.amount,
      p_note: input.note ?? null,
      p_operation_id: input.operation_id,
    })
  },

  updateWithAudit(
    event: H3Event,
    billingPeriodId: string,
    actorId: string,
    chargeId: string,
    input: Omit<IncidentalChargeUpdateInput, 'label' | 'amount' | 'note'> & {
      label: string
      amount: number
      note: string | null
    },
  ): Promise<BillingIncidentalCharge> {
    return callRpc(event, 'update_billing_incidental_charge_with_audit', {
      p_billing_period_id: billingPeriodId,
      p_charge_id: chargeId,
      p_expected_updated_at: input.expected_updated_at,
      p_actor_id: actorId,
      p_label: input.label,
      p_amount: input.amount,
      p_note: input.note,
    })
  },

  deleteWithAudit(
    event: H3Event,
    billingPeriodId: string,
    actorId: string,
    chargeId: string,
    expectedUpdatedAt: string,
  ): Promise<BillingIncidentalCharge> {
    return callRpc(event, 'delete_billing_incidental_charge_with_audit', {
      p_billing_period_id: billingPeriodId,
      p_charge_id: chargeId,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_id: actorId,
    })
  },
}
