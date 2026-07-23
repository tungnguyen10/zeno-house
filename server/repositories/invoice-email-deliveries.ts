import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '~/types/database.types'
import type { InvoiceEmailDeliveryRow } from '~/utils/mappers/invoice-email'
import { db as serverSupabaseClient } from '../utils/db'

export interface InternalInvoiceEmailDeliveryRow extends InvoiceEmailDeliveryRow {
  skip_reason: string | null
  locked_by: string | null
}

type DeliveryDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      invoice_email_deliveries: {
        Row: InternalInvoiceEmailDeliveryRow
        Insert: Partial<InternalInvoiceEmailDeliveryRow>
        Update: Partial<InternalInvoiceEmailDeliveryRow>
        Relationships: []
      }
    }
  }
}

type RpcResponse<T> = PromiseLike<{ data: T | null; error: unknown }>
type EnqueueRpc = (
  name: 'enqueue_invoice_email_delivery',
  args: { p_invoice_id: string; p_actor_id: string },
) => RpcResponse<Json>
type ClaimRpc = (
  name: 'claim_invoice_email_deliveries',
  args: { p_worker_id: string; p_limit: number },
) => RpcResponse<InternalInvoiceEmailDeliveryRow[]>
type ApplyWebhookRpc = (
  name: 'apply_invoice_email_webhook_event',
  args: {
    p_svix_id: string
    p_provider_email_id: string
    p_event_type: string
    p_event_created_at: string
  },
) => RpcResponse<Json>

function client(event: H3Event): SupabaseClient<DeliveryDatabase> {
  return serverSupabaseClient(event) as unknown as SupabaseClient<DeliveryDatabase>
}

export const InvoiceEmailDeliveryRepository = {
  async enqueue(
    event: H3Event,
    input: { invoiceId: string; actorId: string },
  ): Promise<{ row: InternalInvoiceEmailDeliveryRow; reused: boolean }> {
    const rpc = client(event).rpc as unknown as EnqueueRpc
    const { data, error } = await rpc('enqueue_invoice_email_delivery', {
      p_invoice_id: input.invoiceId,
      p_actor_id: input.actorId,
    })
    if (error) throwDbError(error, 'invoiceEmailDelivery.enqueue')
    const result = data as unknown as {
      delivery?: InternalInvoiceEmailDeliveryRow
      reused?: boolean
    } | null
    if (!result?.delivery) {
      throwInternal(new Error('Email enqueue returned no delivery'), 'invoiceEmailDelivery.enqueue')
    }
    return { row: result.delivery, reused: result.reused === true }
  },

  async listByInvoiceId(
    event: H3Event,
    invoiceId: string,
  ): Promise<InternalInvoiceEmailDeliveryRow[]> {
    const { data, error } = await client(event)
      .from('invoice_email_deliveries')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
    if (error) throwDbError(error, 'invoiceEmailDelivery.listByInvoiceId')
    return data ?? []
  },

  async claim(
    event: H3Event,
    workerId: string,
    limit = 20,
  ): Promise<InternalInvoiceEmailDeliveryRow[]> {
    const rpc = client(event).rpc as unknown as ClaimRpc
    const { data, error } = await rpc('claim_invoice_email_deliveries', {
      p_worker_id: workerId,
      p_limit: limit,
    })
    if (error) throwDbError(error, 'invoiceEmailDelivery.claim')
    return data ?? []
  },

  async markAccepted(
    event: H3Event,
    input: { id: string; workerId: string; providerEmailId: string; acceptedAt: string },
  ): Promise<void> {
    const { error } = await client(event)
      .from('invoice_email_deliveries')
      .update({
        status: 'accepted',
        provider_email_id: input.providerEmailId,
        accepted_at: input.acceptedAt,
        last_error_code: null,
        last_error_message: null,
        lease_expires_at: null,
        locked_by: null,
      } as never)
      .eq('id', input.id)
      .eq('status', 'processing')
      .eq('locked_by', input.workerId)
    if (error) throwDbError(error, 'invoiceEmailDelivery.markAccepted')
  },

  async markRetry(
    event: H3Event,
    input: {
      id: string
      workerId: string
      nextAttemptAt: string
      errorCode: string
      errorMessage: string
    },
  ): Promise<void> {
    const { error } = await client(event)
      .from('invoice_email_deliveries')
      .update({
        status: 'queued',
        next_attempt_at: input.nextAttemptAt,
        last_error_code: input.errorCode,
        last_error_message: input.errorMessage,
        lease_expires_at: null,
        locked_by: null,
      } as never)
      .eq('id', input.id)
      .eq('status', 'processing')
      .eq('locked_by', input.workerId)
    if (error) throwDbError(error, 'invoiceEmailDelivery.markRetry')
  },

  async markFailed(
    event: H3Event,
    input: {
      id: string
      workerId: string
      failedAt: string
      errorCode: string
      errorMessage: string
    },
  ): Promise<void> {
    const { error } = await client(event)
      .from('invoice_email_deliveries')
      .update({
        status: 'failed',
        failed_at: input.failedAt,
        last_error_code: input.errorCode,
        last_error_message: input.errorMessage,
        lease_expires_at: null,
        locked_by: null,
      } as never)
      .eq('id', input.id)
      .eq('status', 'processing')
      .eq('locked_by', input.workerId)
    if (error) throwDbError(error, 'invoiceEmailDelivery.markFailed')
  },

  async applyWebhookEvent(
    event: H3Event,
    input: {
      svixId: string
      providerEmailId: string
      eventType: string
      eventCreatedAt: string
    },
  ): Promise<{ duplicate: boolean; matched: boolean; updated: boolean }> {
    const rpc = client(event).rpc as unknown as ApplyWebhookRpc
    const { data, error } = await rpc('apply_invoice_email_webhook_event', {
      p_svix_id: input.svixId,
      p_provider_email_id: input.providerEmailId,
      p_event_type: input.eventType,
      p_event_created_at: input.eventCreatedAt,
    })
    if (error) throwDbError(error, 'invoiceEmailDelivery.applyWebhookEvent')
    const result = data as {
      duplicate?: boolean
      matched?: boolean
      updated?: boolean
    } | null
    return {
      duplicate: result?.duplicate === true,
      matched: result?.matched === true,
      updated: result?.updated === true,
    }
  },
}
