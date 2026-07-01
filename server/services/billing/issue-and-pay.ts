import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { AuthUser } from '~/types/auth'
import type { Database } from '~/types/database.types'
import type { Invoice } from '~/types/billing'
import type { IssueAndPayInput } from '~/utils/validators/billing-issue-pay'
import { mapInvoice } from '~/utils/mappers/billing'
import { newCorrelationId } from '../../utils/billing/correlation'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingDraftService } from './drafts'
import { BillingDisplayResolver } from './display'
import { assertBuildingScope } from '../../utils/scope'

interface IssueAndPayErrorDetails {
  error_code?: string
}

function parseIssueAndPayDetails(raw: unknown): IssueAndPayErrorDetails {
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    return (JSON.parse(raw) as IssueAndPayErrorDetails) ?? {}
  }
  catch {
    return {}
  }
}

const ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  PERIOD_LOCKED: { status: 409, code: 'CONFLICT', message: 'Kỳ đã chốt — không thể phát hành hoá đơn' },
  ALREADY_ISSUED: { status: 409, code: 'CONFLICT', message: 'Hợp đồng đã có hoá đơn trong kỳ này' },
  DRAFT_NOT_READY: { status: 409, code: 'CONFLICT', message: 'Bản nháp chưa sẵn sàng để phát hành' },
}

export const IssueAndPayService = {
  /**
   * Issue a single ready draft and record a full-balance payment against it in
   * one transaction. Recomputes the contract's draft server-side first so the
   * invoice snapshot is fresh and blockers are re-checked, then delegates the
   * atomic write to the `public.issue_and_pay` PL/pgSQL function.
   */
  async issueAndPay(
    event: H3Event,
    user: AuthUser,
    periodId: string,
    input: IssueAndPayInput,
  ): Promise<Invoice> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền phát hành & ghi nhận thanh toán')

    const period = await BillingPeriodRepository.findById(event, periodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period.status === 'closed') throwConflict('Kỳ đã chốt — không thể phát hành hoá đơn')

    const draftResp = await BillingDraftService.calculateDraft(event, user, periodId)
    const draft = draftResp.drafts.find(d => d.contractId === input.contract_id)
    if (!draft) throwNotFound('Không tìm thấy bản nháp cho hợp đồng')
    if (draft.existingInvoiceId !== null) throwConflict('Hợp đồng đã có hoá đơn trong kỳ này')
    if (draft.blockers.length > 0) throwConflict('Bản nháp còn vướng mắc — không thể phát hành')

    const draftPayload = {
      contract_id: draft.contractId,
      room_id: draft.roomId,
      tenant_id: draft.tenantId,
      subtotal: draft.subtotalAmount,
      discount: draft.discountAmount,
      surcharge: draft.surchargeAmount,
      total: draft.totalAmount,
      notes: null,
      lines: draft.lines.map((l, idx) => ({
        charge_type: l.chargeType,
        label: l.label,
        source_type: l.sourceType,
        source_id: l.sourceId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        amount: l.amount,
        metadata: l.metadata ?? {},
        sort_order: l.sortOrder ?? idx,
      })),
    }

    const client = await serverSupabaseClient(event)
    const args = {
      p_period_id: period.id,
      p_contract_id: input.contract_id,
      p_actor_id: user.id ?? null,
      p_due_date: input.due_date ?? null,
      p_issued_at: new Date().toISOString(),
      p_payment_date: input.payment_date,
      p_payment_method: input.payment_method ?? null,
      p_note: input.note ?? null,
      p_draft: draftPayload,
      p_correlation_id: newCorrelationId(),
    } as unknown as Database['public']['Functions']['issue_and_pay']['Args']

    const { data, error } = await client.rpc('issue_and_pay', args)
    if (error) {
      const details = parseIssueAndPayDetails((error as { details?: unknown }).details)
      const mapped = details.error_code ? ERROR_MAP[details.error_code] : undefined
      const status = mapped?.status ?? (error.code === 'P0002' ? 404 : 500)
      throw createError({
        statusCode: status,
        data: {
          error: {
            code: mapped?.code ?? (status === 404 ? 'NOT_FOUND' : 'INTERNAL'),
            message: mapped?.message ?? error.message,
          },
        },
      })
    }

    const rows = (data as Array<Record<string, unknown>> | null) ?? []
    const first = rows[0]
    if (!first) {
      throw createError({
        statusCode: 500,
        data: { error: { code: 'INTERNAL', message: 'Phát hành & thu thất bại' } },
      })
    }

    const invoice = mapInvoice(first as never)
    const [enriched] = await new BillingDisplayResolver(event).enrichInvoices([invoice])
    return enriched ?? invoice
  },
}
