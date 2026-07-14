import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('#supabase/server', () => ({ serverSupabaseServiceRole: vi.fn(() => ({ rpc })) }))

const invoiceRow = {
  id: '00000000-0000-4000-8000-000000000001',
  invoice_code: 'inv-2026-07-0001',
  billing_period_id: '00000000-0000-4000-8000-000000000002',
  contract_id: '00000000-0000-4000-8000-000000000003',
  room_id: '00000000-0000-4000-8000-000000000004',
  tenant_id: '00000000-0000-4000-8000-000000000005',
  status: 'issued', due_date: '2026-07-31', issued_at: '2026-07-14T00:00:00.000Z',
  paid_at: null, voided_at: null, voided_by: null, void_reason: null,
  superseded_by_invoice_id: null, supersedes_invoice_id: null,
  subtotal_amount: 1000, discount_amount: 0, surcharge_amount: 0,
  total_amount: 1000, paid_amount: 0, balance_amount: 1000, notes: null,
  created_at: '2026-07-14T00:00:00.000Z', updated_at: '2026-07-14T00:00:00.000Z',
}

const chargeRow = {
  id: '00000000-0000-4000-8000-000000000006', invoice_id: invoiceRow.id,
  charge_type: 'adjustment', label: 'Điều chỉnh', source_type: 'adjustment', source_id: null,
  quantity: 1, unit_price: 100, amount: 100, metadata: {}, sort_order: 100,
  created_at: '2026-07-14T00:00:00.000Z',
}

describe('InvoiceRepository atomic RPCs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the server operation id to issue replay contract', async () => {
    rpc.mockResolvedValue({ data: [invoiceRow], error: null })
    const { InvoiceRepository } = await import('../../../server/repositories/billing/invoices')
    const result = await InvoiceRepository.issuePeriodWithAudit({ context: {} } as never, {
      periodId: invoiceRow.billing_period_id,
      actorId: '00000000-0000-4000-8000-000000000007',
      dueDate: invoiceRow.due_date,
      issuedAt: invoiceRow.issued_at,
      requestedContractIds: [invoiceRow.contract_id],
      drafts: [{ contract_id: invoiceRow.contract_id }],
      operationId: '00000000-0000-4000-8000-000000000008',
    })
    expect(result[0]?.id).toBe(invoiceRow.id)
    expect(rpc).toHaveBeenCalledWith('issue_period_invoices', expect.objectContaining({
      p_correlation_id: '00000000-0000-4000-8000-000000000008',
    }))
  })

  it('passes expected version and correlation to correction RPCs', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ ...invoiceRow, status: 'void' }], error: null })
      .mockResolvedValueOnce({ data: [invoiceRow], error: null })
      .mockResolvedValueOnce({ data: { invoice: invoiceRow, charge: chargeRow }, error: null })
    const { InvoiceRepository } = await import('../../../server/repositories/billing/invoices')
    const shared = {
      invoiceId: invoiceRow.id,
      expectedUpdatedAt: invoiceRow.updated_at,
      actorId: '00000000-0000-4000-8000-000000000007',
      reason: 'Đính chính nghiệp vụ',
      correlationId: '00000000-0000-4000-8000-000000000008',
    }
    await InvoiceRepository.voidWithAudit({ context: {} } as never, shared)
    await InvoiceRepository.reissueWithAudit({ context: {} } as never, {
      ...shared, dueDate: null, issuedAt: invoiceRow.issued_at, notes: null, draft: {},
    })
    await InvoiceRepository.addAdjustmentWithAudit({ context: {} } as never, {
      ...shared, label: 'Điều chỉnh', amount: 100, referenceInvoiceId: null,
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'void_invoice_with_audit', expect.objectContaining({
      p_expected_updated_at: invoiceRow.updated_at,
      p_correlation_id: shared.correlationId,
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'reissue_invoice_with_audit', expect.any(Object))
    expect(rpc).toHaveBeenNthCalledWith(3, 'add_invoice_adjustment_with_audit', expect.any(Object))
  })

  it('normalizes stale and payment-state errors', async () => {
    const { InvoiceRepository } = await import('../../../server/repositories/billing/invoices')
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVOICE_VERSION_CONFLICT' } })
    await expect(InvoiceRepository.voidWithAudit({ context: {} } as never, {
      invoiceId: invoiceRow.id, expectedUpdatedAt: invoiceRow.updated_at, actorId: null,
      reason: 'Đính chính nghiệp vụ', correlationId: '00000000-0000-4000-8000-000000000008',
    })).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT' } } },
    })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVOICE_HAS_ACTIVE_PAYMENTS' } })
    await expect(InvoiceRepository.voidWithAudit({ context: {} } as never, {
      invoiceId: invoiceRow.id, expectedUpdatedAt: invoiceRow.updated_at, actorId: null,
      reason: 'Đính chính nghiệp vụ', correlationId: '00000000-0000-4000-8000-000000000008',
    })).rejects.toMatchObject({ statusCode: 409 })
  })
})
