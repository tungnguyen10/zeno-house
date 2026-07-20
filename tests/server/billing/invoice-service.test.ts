import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findInvoiceById = vi.fn()
const findInvoiceByIdentifier = vi.fn()
const voidWithAudit = vi.fn()
const findActiveByPeriodContract = vi.fn()
const issuePeriodWithAudit = vi.fn()
const reissueWithAudit = vi.fn()
const addAdjustmentWithAudit = vi.fn()
const listCharges = vi.fn()
const listPaymentsByInvoice = vi.fn()
const findPeriodById = vi.fn()
const append = vi.fn()
const findLatestCorrelation = vi.fn()
const calculateDraft = vi.fn()
const enrichInvoices = vi.fn(async invoices => invoices)
const enrichPayments = vi.fn(async payments => payments)
const findInvoiceSnapshots = vi.fn()
const resolveProfileDisplays = vi.fn()
const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    findById: findInvoiceById,
    findByIdentifier: findInvoiceByIdentifier,
    voidWithAudit,
    findActiveByPeriodContract,
    issuePeriodWithAudit,
    reissueWithAudit,
    addAdjustmentWithAudit,
    listCharges,
  },
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findById: findPeriodById,
  },
}))

vi.mock('../../../server/repositories/billing/payments', () => ({
  InvoicePaymentRepository: {
    listByInvoice: listPaymentsByInvoice,
  },
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    append,
  },
}))

vi.mock('../../../server/repositories/billing/audit', () => ({
  BillingAuditRepository: {
    findLatestCorrelation,
  },
}))

vi.mock('../../../server/services/billing/drafts', () => ({
  BillingDraftService: {
    calculateDraft,
  },
}))

vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return { enrichInvoices, enrichPayments }
  }),
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { findInvoiceSnapshotsByIds: findInvoiceSnapshots },
}))

vi.mock('../../../server/services/billing/invoice-profile-display', () => ({
  InvoiceProfileDisplayService: { resolveMany: resolveProfileDisplays },
}))

function makeUser(role: 'admin' | 'manager' = 'admin'): AuthUser {
  return {
    id: 'user-1',
    app_metadata: { role },
  } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('InvoiceService invoice lifecycle methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', () => true)
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'issued' }))
    listCharges.mockResolvedValue([])
    listPaymentsByInvoice.mockResolvedValue([])
    findInvoiceSnapshots.mockResolvedValue(new Map())
    resolveProfileDisplays.mockResolvedValue(new Map())
  })

  it('loads an invoice by business code and uses the resolved id for child rows', async () => {
    const invoice = buildInvoice({ id: 'invoice-1', invoiceCode: 'inv-2026-05-0001' })
    findInvoiceByIdentifier.mockResolvedValue(invoice)
    listCharges.mockResolvedValue([{ id: 'charge-1' }])
    listPaymentsByInvoice.mockResolvedValue([{ id: 'payment-1' }])
    resolveProfileDisplays.mockResolvedValue(new Map([
      ['invoice-1', { bankName: 'VIB', qrImageUrl: 'signed:qr' }],
    ]))
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.getWithCharges(
      event(),
      makeUser(),
      'inv-2026-05-0001',
    )

    expect(findInvoiceByIdentifier).toHaveBeenCalledWith(expect.anything(), 'inv-2026-05-0001')
    expect(listCharges).toHaveBeenCalledWith(expect.anything(), invoice.id)
    expect(listPaymentsByInvoice).toHaveBeenCalledWith(expect.anything(), invoice.id)
    expect(result.invoice.invoiceCode).toBe('inv-2026-05-0001')
    expect(result.invoiceProfile).toMatchObject({ bankName: 'VIB', qrImageUrl: 'signed:qr' })
  })

  it('voids an issued invoice with no payments and records audit metadata', async () => {
    const invoice = buildInvoice({ id: 'invoice-1', paidAmount: 0, status: 'issued' })
    const voided = buildInvoice({ ...invoice, status: 'void', voidReason: 'wrong reading' })
    findInvoiceByIdentifier.mockResolvedValue(invoice)
    voidWithAudit.mockResolvedValue(voided)
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.voidInvoice(event(), makeUser(), invoice.id, {
      reason: 'wrong reading', expected_updated_at: invoice.updatedAt,
    })

    expect(result.status).toBe('void')
    expect(voidWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      invoiceId: invoice.id, actorId: 'user-1', reason: 'wrong reading',
      expectedUpdatedAt: invoice.updatedAt,
    }))
    expect(append).not.toHaveBeenCalled()
  })

  it('returns 404 when manager reads an invoice whose period building is outside scope', async () => {
    const invoice = buildInvoice({ id: 'invoice-1', billingPeriodId: 'period-2' })
    findInvoiceByIdentifier.mockResolvedValue(invoice)
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-2', buildingId: 'building-2' }))
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    await expect(InvoiceService.getWithCharges(event(), makeUser('manager'), invoice.id))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('requires billing.corrections for invoice void', async () => {
    vi.stubGlobal('can', (_user: AuthUser, capability: string) => capability === 'billing.write')
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    await expect(InvoiceService.voidInvoice(event(), makeUser('manager'), 'invoice-1', {
      reason: 'wrong reading', expected_updated_at: '2026-07-14T00:00:00.000Z',
    }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('allows manager with billing.corrections to void an assigned invoice', async () => {
    const invoice = buildInvoice({ id: 'invoice-1', paidAmount: 0, status: 'issued' })
    const voided = buildInvoice({ ...invoice, status: 'void', voidReason: 'wrong reading' })
    findInvoiceByIdentifier.mockResolvedValue(invoice)
    voidWithAudit.mockResolvedValue(voided)
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.voidInvoice(event(), makeUser('manager'), invoice.id, {
      reason: 'wrong reading', expected_updated_at: invoice.updatedAt,
    })

    expect(result.status).toBe('void')
    expect(voidWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ invoiceId: invoice.id }))
  })

  it('forwards issuable drafts to issue_period_invoices and returns the issued rows', async () => {
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'review' }))
    const issued = buildInvoice({ id: 'invoice-issued', totalAmount: 1_720_000 })
    calculateDraft.mockResolvedValue({
      totals: {
        blockedDraftCount: 1,
        issuableDraftCount: 1,
      },
      drafts: [
        {
          contractId: 'contract-ready',
          roomId: 'room-ready',
          tenantId: 'tenant-ready',
          subtotalAmount: 1_820_000,
          discountAmount: 100_000,
          surchargeAmount: 0,
          totalAmount: 1_720_000,
          blockers: [],
          existingInvoiceId: null,
          lines: [
            {
              chargeType: 'electricity',
              label: 'Electricity replacement usage',
              sourceType: 'override',
              sourceId: 'override-1',
              quantity: 35,
              unitPrice: 4_000,
              amount: 140_000,
              sortOrder: 20,
              metadata: {
                source: 'usage_override',
                previous_reading_id: 'prev-reading',
                previous_reading_value: 100,
                current_reading_id: 'current-reading',
                current_reading_value: 5,
                old_meter_final_value: 130,
                new_meter_start_value: 0,
                billable_usage: 35,
                rate: 4_000,
                pricing_type: 'per_kwh',
              },
            },
          ],
        },
        {
          contractId: 'contract-blocked',
          roomId: 'room-blocked',
          tenantId: 'tenant-blocked',
          subtotalAmount: 0,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 0,
          blockers: [{ code: 'missing_current_reading', message: 'missing', meta: {} }],
          existingInvoiceId: null,
          lines: [],
        },
        {
          contractId: 'contract-existing',
          roomId: 'room-existing',
          tenantId: 'tenant-existing',
          subtotalAmount: 1_000_000,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 1_000_000,
          blockers: [],
          existingInvoiceId: 'invoice-existing',
          lines: [],
        },
      ],
    })
    issuePeriodWithAudit.mockResolvedValueOnce([issued])
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.issueInvoices(
      event(),
      makeUser(),
      'period-1',
      { due_date: '2026-06-05' },
    )

    expect(result.issuedCount).toBe(1)
    expect(issuePeriodWithAudit).toHaveBeenCalledTimes(1)
    expect(issuePeriodWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      periodId: 'period-1',
      actorId: 'user-1',
      dueDate: '2026-06-05',
      drafts: [expect.objectContaining({
        contract_id: 'contract-ready',
        total: 1_720_000,
        lines: [expect.objectContaining({
          charge_type: 'electricity',
          source_type: 'override',
          source_id: 'override-1',
          quantity: 35,
          metadata: expect.objectContaining({
            source: 'usage_override',
            previous_reading_value: 100,
            current_reading_value: 5,
            billable_usage: 35,
            pricing_type: 'per_kwh',
          }),
        })],
      })],
    }))
    // `invoices.issued` audit is now emitted inside the RPC, NOT by the
    // service — make sure we don't double-write it from TS.
    expect(append).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: 'invoices.issued' }),
    )
  })

  it('audits an issue attempt and creates no invoices when all drafts are blocked or already issued', async () => {
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'review' }))
    calculateDraft.mockResolvedValue({
      totals: {
        blockedDraftCount: 1,
        issuableDraftCount: 0,
      },
      drafts: [
        {
          contractId: 'contract-blocked',
          roomId: 'room-blocked',
          tenantId: 'tenant-blocked',
          subtotalAmount: 0,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 0,
          blockers: [{ code: 'missing_current_reading', message: 'missing', meta: {} }],
          existingInvoiceId: null,
          lines: [],
        },
        {
          contractId: 'contract-existing',
          roomId: 'room-existing',
          tenantId: 'tenant-existing',
          subtotalAmount: 1_000_000,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 1_000_000,
          blockers: [],
          existingInvoiceId: 'invoice-existing',
          lines: [],
        },
      ],
    })
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.issueInvoices(
      event(),
      makeUser(),
      'period-1',
      { due_date: '2026-06-05' },
    )

    expect(result).toEqual({ issuedCount: 0, invoices: [] })
    expect(issuePeriodWithAudit).not.toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'invoice.issue_attempted',
      metadata: expect.objectContaining({ blocked_count: 1, issuable_count: 0, issued: 0 }),
    }))
  })

  it('blocks voiding invoices that already have payments', async () => {
    findInvoiceByIdentifier.mockResolvedValue(buildInvoice({ paidAmount: 100_000, status: 'partial' }))
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    await expect(InvoiceService.voidInvoice(event(), makeUser(), 'invoice-1', {
      reason: 'wrong reading', expected_updated_at: '2026-07-14T00:00:00.000Z',
    }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(voidWithAudit).not.toHaveBeenCalled()
  })

  it('reissues a voided invoice and links the replacement to the original invoice', async () => {
    const voided = buildInvoice({ id: 'invoice-old', status: 'void', paidAmount: 0, voidReason: 'wrong reading' })
    const replacement = buildInvoice({ id: 'invoice-new', supersedesInvoiceId: voided.id })
    findInvoiceByIdentifier.mockResolvedValue(voided)
    findActiveByPeriodContract.mockResolvedValue(null)
    findLatestCorrelation.mockResolvedValue('00000000-0000-4000-8000-000000000009')
    calculateDraft.mockResolvedValue({
      drafts: [{
        contractId: voided.contractId,
        roomId: voided.roomId,
        tenantId: voided.tenantId,
        subtotalAmount: 1_000_000,
        discountAmount: 0,
        surchargeAmount: 0,
        totalAmount: 1_000_000,
        blockers: [],
        lines: [],
      }],
    })
    reissueWithAudit.mockResolvedValue(replacement)
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.reissueInvoice(
      event(),
      makeUser(),
      voided.id,
      {
        due_date: '2026-06-05', reason: 'wrong reading fixed',
        expected_updated_at: voided.updatedAt,
      },
    )

    expect(result.id).toBe(replacement.id)
    expect(reissueWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      invoiceId: voided.id,
      expectedUpdatedAt: voided.updatedAt,
      reason: 'wrong reading fixed',
      correlationId: '00000000-0000-4000-8000-000000000009',
    }))
    expect(append).not.toHaveBeenCalled()
  })

  it('routes paid invoice adjustments through the atomic repository contract', async () => {
    const target = buildInvoice({ id: 'invoice-paid', status: 'paid', paidAmount: 1_000_000, balanceAmount: 0 })
    const updated = buildInvoice({ ...target, totalAmount: 1_100_000, balanceAmount: 100_000, status: 'partial' })
    const charge = { id: 'charge-adjustment', invoiceId: target.id, amount: 100_000 }
    findInvoiceByIdentifier.mockResolvedValue(target)
    addAdjustmentWithAudit.mockResolvedValue({ invoice: updated, charge })
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.addAdjustment(event(), makeUser(), {
      target_invoice_id: target.id,
      label: 'Điều chỉnh tiền điện',
      amount: 100_000,
      reason: 'Bổ sung chênh lệch chỉ số',
      reference_invoice_id: null,
      expected_updated_at: target.updatedAt,
    })

    expect(result.invoice.id).toBe(target.id)
    expect(addAdjustmentWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      invoiceId: target.id,
      expectedUpdatedAt: target.updatedAt,
      amount: 100_000,
    }))
    expect(append).not.toHaveBeenCalled()
  })

  // After the RPC hardening, a charge-write failure inside the PL/pgSQL
  // function aborts the whole transaction. The service only sees an error
  // envelope; no invoices are returned, no `invoices.issued` audit fires from
  // TS, and the issuable count is preserved for retry.
  it('aborts the whole batch and writes no success audit when issue_period_invoices fails', async () => {
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'review' }))
    const buildDraft = (contractId: string, totalAmount: number) => ({
      contractId,
      roomId: `room-${contractId}`,
      tenantId: `tenant-${contractId}`,
      subtotalAmount: totalAmount,
      discountAmount: 0,
      surchargeAmount: 0,
      totalAmount,
      blockers: [],
      existingInvoiceId: null,
      lines: [{
        chargeType: 'rent',
        label: 'Rent',
        sourceType: null,
        sourceId: null,
        quantity: 1,
        unitPrice: totalAmount,
        amount: totalAmount,
        sortOrder: 0,
        metadata: {},
      }],
    })
    calculateDraft.mockResolvedValue({
      totals: { blockedDraftCount: 0, issuableDraftCount: 3 },
      drafts: [
        buildDraft('contract-1', 1_000_000),
        buildDraft('contract-2', 2_000_000),
        buildDraft('contract-3', 3_000_000),
      ],
    })

    issuePeriodWithAudit.mockRejectedValueOnce(Object.assign(new Error('INVOICE_LINE_TOTAL_MISMATCH'), {
      statusCode: 400,
      data: { error: { code: 'VALIDATION_ERROR' } },
    }))

    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    await expect(
      InvoiceService.issueInvoices(
        event(),
        makeUser(),
        'period-1',
        { due_date: '2026-06-05' },
      ),
    ).rejects.toMatchObject({ statusCode: 400 })

    // RPC was called exactly once with all three drafts (atomic batch).
    expect(issuePeriodWithAudit).toHaveBeenCalledTimes(1)
    expect((issuePeriodWithAudit.mock.calls[0]![1] as { drafts: unknown[] }).drafts).toHaveLength(3)

    // No TS-side audit append — both `invoices.issued` and the period status
    // transition audit are now inside the RPC and never fire on a failed
    // transaction.
    expect(append).not.toHaveBeenCalled()
  })
})
