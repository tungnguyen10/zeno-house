import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Invoice, InvoiceCharge } from '~/types/billing'
import type { InvoiceStatus } from '~/utils/constants/billing'
import { mapInvoice, mapInvoiceCharge } from '~/utils/mappers/billing'
import { isUuid } from '~/utils/format/slug'
import type { ChargeInput } from '~/utils/validators/billing'
import type { Database, Tables } from '~/types/database.types'

export interface InvoiceIssueRpcInput {
  periodId: string
  actorId: string | null
  dueDate: string | null
  issuedAt: string
  requestedContractIds: string[] | null
  drafts: Array<Record<string, unknown>>
  operationId: string
}

export interface InvoiceReissueRpcInput {
  invoiceId: string
  expectedUpdatedAt: string
  actorId: string | null
  dueDate: string | null
  issuedAt: string
  notes: string | null
  reason: string
  draft: Record<string, unknown>
  correlationId: string
}

export interface InvoiceAdjustmentRpcInput {
  invoiceId: string
  expectedUpdatedAt: string
  actorId: string | null
  label: string
  amount: number
  reason: string
  referenceInvoiceId: string | null
  correlationId: string
}

function invoiceRpcMessage(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message.toUpperCase()
    : ''
}

export function throwInvoiceRpcError(error: unknown): never {
  const message = invoiceRpcMessage(error)
  if (message.includes('INVOICE_VERSION_CONFLICT')) {
    throwConflict('Hoá đơn đã thay đổi. Vui lòng tải lại dữ liệu.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('BILLING_PERIOD_LOCKED')) {
    throwConflict('Kỳ đã chốt, không thể thay đổi hoá đơn.')
  }
  if (message.includes('INVOICE_HAS_ACTIVE_PAYMENTS')) {
    throwConflict('Hoá đơn đã có khoản thu đang hiệu lực. Hãy dùng luồng điều chỉnh phù hợp.')
  }
  if (message.includes('INVOICE_ALREADY_ISSUED') || message.includes('INVOICE_ACTIVE_REPLACEMENT_EXISTS')) {
    throwConflict('Đã có hoá đơn hiệu lực cho hợp đồng trong kỳ này.')
  }
  if (message.includes('INVOICE_ALREADY_VOID') || message.includes('INVOICE_NOT_VOID')) {
    throwConflict('Trạng thái hoá đơn không còn phù hợp với thao tác này.')
  }
  if (message.includes('INVOICE_NOT_FOUND') || message.includes('INVOICE_REFERENCE_NOT_FOUND')) {
    throwNotFound('Không tìm thấy hoá đơn')
  }
  if (
    message.includes('INVOICE_REASON_REQUIRED')
    || message.includes('INVOICE_DRAFT_')
    || message.includes('INVOICE_LINE_TOTAL_MISMATCH')
    || message.includes('INVOICE_ADJUSTMENT_')
  ) {
    throwValidationError('Dữ liệu thao tác hoá đơn không hợp lệ.')
  }
  throwDbError(error, 'billing.invoices.atomicOperation')
}

function sequenceFromCode(prefix: string, code: string | null): number {
  if (!code?.startsWith(`${prefix}-`)) return 0
  const seq = Number(code.slice(prefix.length + 1))
  return Number.isInteger(seq) ? seq : 0
}

async function buildUniqueInvoiceCode(event: H3Event, billingPeriodId: string): Promise<string> {
  const client = await serverSupabaseClient(event)
  const { data: period, error: periodError } = await client
    .from('billing_periods')
    .select('period_year, period_month')
    .eq('id', billingPeriodId)
    .single()
  if (periodError) throwDbError(periodError, 'billing.invoices.buildUniqueInvoiceCode.period')

  const prefix = `inv-${period.period_year}-${String(period.period_month).padStart(2, '0')}`
  const { data, error } = await client
    .from('invoices')
    .select('invoice_code')
    .ilike('invoice_code', `${prefix}-%`)
  if (error) throwDbError(error, 'billing.invoices.buildUniqueInvoiceCode')

  const used = new Set((data ?? []).map(row => row.invoice_code).filter(Boolean))
  let next = Math.max(0, ...(data ?? []).map(row => sequenceFromCode(prefix, row.invoice_code))) + 1

  while (used.has(`${prefix}-${String(next).padStart(4, '0')}`)) next++
  return `${prefix}-${String(next).padStart(4, '0')}`
}

export const InvoiceRepository = {
  async issuePeriodWithAudit(event: H3Event, input: InvoiceIssueRpcInput): Promise<Invoice[]> {
    const client = await serverSupabaseClient(event)
    const args = {
      p_period_id: input.periodId,
      p_actor_id: input.actorId,
      p_due_date: input.dueDate,
      p_issued_at: input.issuedAt,
      p_requested_contract_ids: input.requestedContractIds,
      p_drafts: input.drafts,
      p_correlation_id: input.operationId,
    } as unknown as Database['public']['Functions']['issue_period_invoices']['Args']
    const { data, error } = await client.rpc('issue_period_invoices', args)
    if (error) throwInvoiceRpcError(error)
    return ((data ?? []) as Tables<'invoices'>[]).map(mapInvoice)
  },

  async voidWithAudit(
    event: H3Event,
    input: {
      invoiceId: string
      expectedUpdatedAt: string
      actorId: string | null
      reason: string
      correlationId: string
    },
  ): Promise<Invoice> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('void_invoice_with_audit', {
      p_invoice_id: input.invoiceId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_actor_id: input.actorId as string,
      p_reason: input.reason,
      p_correlation_id: input.correlationId,
    })
    if (error) throwInvoiceRpcError(error)
    const row = ((data ?? []) as Tables<'invoices'>[])[0]
    if (!row) throwInternal(new Error('Empty invoice void result'), 'billing.invoices.voidWithAudit')
    return mapInvoice(row)
  },

  async reissueWithAudit(event: H3Event, input: InvoiceReissueRpcInput): Promise<Invoice> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('reissue_invoice_with_audit', {
      p_voided_invoice_id: input.invoiceId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_actor_id: input.actorId as string,
      p_due_date: input.dueDate as string,
      p_issued_at: input.issuedAt,
      p_notes: input.notes as string,
      p_reason: input.reason,
      p_draft: input.draft as Database['public']['Functions']['reissue_invoice_with_audit']['Args']['p_draft'],
      p_correlation_id: input.correlationId,
    })
    if (error) throwInvoiceRpcError(error)
    const row = ((data ?? []) as Tables<'invoices'>[])[0]
    if (!row) throwInternal(new Error('Empty invoice reissue result'), 'billing.invoices.reissueWithAudit')
    return mapInvoice(row)
  },

  async addAdjustmentWithAudit(
    event: H3Event,
    input: InvoiceAdjustmentRpcInput,
  ): Promise<{ invoice: Invoice; charge: InvoiceCharge }> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('add_invoice_adjustment_with_audit', {
      p_invoice_id: input.invoiceId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_actor_id: input.actorId as string,
      p_label: input.label,
      p_amount: input.amount,
      p_reason: input.reason,
      p_reference_invoice_id: input.referenceInvoiceId as string,
      p_correlation_id: input.correlationId,
    })
    if (error) throwInvoiceRpcError(error)
    const result = data as unknown as {
      invoice?: Tables<'invoices'>
      charge?: Tables<'invoice_charges'>
    } | null
    if (!result?.invoice || !result.charge) {
      throwInternal(new Error('Invalid invoice adjustment result'), 'billing.invoices.addAdjustmentWithAudit')
    }
    return { invoice: mapInvoice(result.invoice), charge: mapInvoiceCharge(result.charge) }
  },

  async findManyByIdentifiers(event: H3Event, identifiers: string[]): Promise<Invoice[]> {
    const unique = [...new Set(identifiers)]
    if (unique.length === 0) return []
    const ids = unique.filter(isUuid)
    const codes = unique.filter(identifier => !isUuid(identifier))
    const client = await serverSupabaseClient(event)
    const [byId, byCode] = await Promise.all([
      ids.length > 0
        ? client.from('invoices').select('*').in('id', ids)
        : Promise.resolve({ data: [], error: null }),
      codes.length > 0
        ? client.from('invoices').select('*').in('invoice_code', codes)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (byId.error) throwDbError(byId.error, 'billing.invoices.findManyByIdentifiers.ids')
    if (byCode.error) throwDbError(byCode.error, 'billing.invoices.findManyByIdentifiers.codes')
    return [...(byId.data ?? []), ...(byCode.data ?? [])].map(mapInvoice)
  },
  async listByPeriods(event: H3Event, billingPeriodIds: string[]): Promise<Invoice[]> {
    if (billingPeriodIds.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .in('billing_period_id', billingPeriodIds)
      .order('created_at', { ascending: true })
    if (error) throwDbError(error, 'billing.invoices.listByPeriods')
    return (data ?? []).map(mapInvoice)
  },

  async listByPeriod(event: H3Event, billingPeriodId: string): Promise<Invoice[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .order('created_at', { ascending: true })
    if (error) throwDbError(error, 'billing.invoices.listByPeriod')
    return (data ?? []).map(mapInvoice)
  },

  async listChargesByInvoiceIds(
    event: H3Event,
    invoiceIds: string[],
  ): Promise<Map<string, InvoiceCharge[]>> {
    const grouped = new Map<string, InvoiceCharge[]>()
    for (const invoiceId of invoiceIds) grouped.set(invoiceId, [])
    if (invoiceIds.length === 0) return grouped

    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_charges')
      .select('id, invoice_id, charge_type, label, source_type, source_id, quantity, unit_price, amount, metadata, sort_order, created_at')
      .in('invoice_id', invoiceIds)
      .order('sort_order', { ascending: true })
    if (error) throwDbError(error, 'billing.invoices.listChargesByInvoiceIds')

    for (const row of data ?? []) {
      const charge = mapInvoiceCharge(row)
      const charges = grouped.get(charge.invoiceId) ?? []
      charges.push(charge)
      grouped.set(charge.invoiceId, charges)
    }
    return grouped
  },

  async findById(event: H3Event, id: string): Promise<Invoice | null> {
    return this.findByIdentifier(event, id)
  },

  async findByIdentifier(event: H3Event, identifier: string): Promise<Invoice | null> {
    const client = await serverSupabaseClient(event)
    const column = isUuid(identifier) ? 'id' : 'invoice_code'
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq(column, identifier)
      .maybeSingle()
    if (error) throwDbError(error, 'billing.invoices.findByIdentifier')
    return data ? mapInvoice(data) : null
  },

  async findActiveByPeriodContract(
    event: H3Event,
    billingPeriodId: string,
    contractId: string,
  ): Promise<Invoice | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .eq('contract_id', contractId)
      .neq('status', 'void')
      .maybeSingle()
    if (error) throwDbError(error, 'billing.invoices.findActiveByPeriodContract')
    return data ? mapInvoice(data) : null
  },

  async issueOne(
    event: H3Event,
    input: {
      billing_period_id: string
      contract_id: string
      room_id: string
      tenant_id: string
      due_date: string | null
      issued_at: string
      subtotal: number
      discount: number
      surcharge: number
      total: number
      notes?: string | null
      supersedes_invoice_id?: string | null
    },
    charges: ChargeInput[],
  ): Promise<{ invoice: Invoice; charges: InvoiceCharge[] }> {
    const client = await serverSupabaseClient(event)
    const invoiceCode = await buildUniqueInvoiceCode(event, input.billing_period_id)

    const { data: invoiceRow, error: invErr } = await client
      .from('invoices')
      .insert({
        invoice_code: invoiceCode,
        billing_period_id: input.billing_period_id,
        contract_id: input.contract_id,
        room_id: input.room_id,
        tenant_id: input.tenant_id,
        status: 'issued',
        due_date: input.due_date,
        issued_at: input.issued_at,
        subtotal_amount: input.subtotal,
        discount_amount: input.discount,
        surcharge_amount: input.surcharge,
        total_amount: input.total,
        balance_amount: input.total,
        notes: input.notes ?? null,
        supersedes_invoice_id: input.supersedes_invoice_id ?? null,
      })
      .select()
      .single()
    if (invErr) throwDbError(invErr, 'billing.invoices.issueOne')

    let chargeRows: InvoiceCharge[] = []
    if (charges.length > 0) {
      const { data: chRows, error: chErr } = await client
        .from('invoice_charges')
        .insert(
          charges.map((c, idx) => ({
            invoice_id: invoiceRow.id,
            charge_type: c.charge_type,
            label: c.label,
            source_type: c.source_type ?? null,
            source_id: c.source_id ?? null,
            quantity: c.quantity,
            unit_price: c.unit_price,
            amount: c.amount,
            metadata: (c.metadata ?? {}) as never,
            sort_order: c.sort_order ?? idx,
          })),
        )
        .select()
      if (chErr) {
        // Best-effort rollback: delete the invoice we just created
        await client.from('invoices').delete().eq('id', invoiceRow.id)
        throwDbError(chErr, 'billing.invoices.issueOne.charges')
      }
      chargeRows = (chRows ?? []).map(mapInvoiceCharge)
    }

    return { invoice: mapInvoice(invoiceRow), charges: chargeRows }
  },

  async addCharges(
    event: H3Event,
    invoiceId: string,
    charges: ChargeInput[],
  ): Promise<InvoiceCharge[]> {
    if (charges.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_charges')
      .insert(
        charges.map((c, idx) => ({
          invoice_id: invoiceId,
          charge_type: c.charge_type,
          label: c.label,
          source_type: c.source_type ?? null,
          source_id: c.source_id ?? null,
          quantity: c.quantity,
          unit_price: c.unit_price,
          amount: c.amount,
          metadata: (c.metadata ?? {}) as never,
          sort_order: c.sort_order ?? idx,
        })),
      )
      .select()
    if (error) throwDbError(error, 'billing.invoices.addCharges')
    return (data ?? []).map(mapInvoiceCharge)
  },

  async listCharges(event: H3Event, invoiceId: string): Promise<InvoiceCharge[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_charges')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true })
    if (error) throwDbError(error, 'billing.invoices.listCharges')
    return (data ?? []).map(mapInvoiceCharge)
  },

  async voidById(
    event: H3Event,
    id: string,
    voidedBy: string | null,
    reason: string,
  ): Promise<Invoice> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .update({
        status: 'void',
        voided_at: new Date().toISOString(),
        voided_by: voidedBy,
        void_reason: reason,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throwDbError(error, 'billing.invoices.voidById')
    return mapInvoice(data)
  },

  async linkSupersededBy(
    event: H3Event,
    voidedInvoiceId: string,
    replacementInvoiceId: string,
  ): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('invoices')
      .update({ superseded_by_invoice_id: replacementInvoiceId })
      .eq('id', voidedInvoiceId)
    if (error) throwDbError(error, 'billing.invoices.linkSupersededBy')
  },

  async updatePaymentTotals(
    event: H3Event,
    id: string,
    paid: number,
    balance: number,
    status: InvoiceStatus,
    paidAt: string | null,
  ): Promise<Invoice> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .update({
        paid_amount: paid,
        balance_amount: balance,
        status,
        paid_at: paidAt,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throwDbError(error, 'billing.invoices.updatePaymentTotals')
    return mapInvoice(data)
  },

  async listOutstandingByPeriod(event: H3Event, billingPeriodId: string): Promise<Invoice[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .gt('balance_amount', 0)
      .neq('status', 'void')
    if (error) throwDbError(error, 'billing.invoices.listOutstandingByPeriod')
    return (data ?? []).map(mapInvoice)
  },
}
