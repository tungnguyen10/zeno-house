import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingDraftResponse } from '~/types/billing'
import { buildPeriod } from '../../__fixtures__/billing/period'

const calculateDraft = vi.fn()
const findBuilding = vi.fn()
const findProfile = vi.fn()
const signAsset = vi.fn()
const issueInvoices = vi.fn()
const findIssueReplay = vi.fn()

vi.mock('../../../server/services/billing/drafts', () => ({
  BillingDraftService: { calculateDraft },
}))
vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuilding },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { findByBuildingId: findProfile, signAsset },
}))
vi.mock('../../../server/services/billing/invoices', () => ({
  InvoiceService: { issueInvoices, findIssueReplay },
}))

const periodId = '00000000-0000-4000-8000-000000000010'
const buildingId = '00000000-0000-4000-8000-000000000011'
const contractId = '00000000-0000-4000-8000-000000000001'
const operationId = '00000000-0000-7000-8000-000000000099'
const user = { id: 'user-1', app_metadata: { role: 'admin' } } as never

function draftResponse(total = 3_200_000): BillingDraftResponse {
  return {
    period: buildPeriod({
      id: periodId,
      buildingId,
      status: 'review',
      periodMonth: 8,
      periodYear: 2026,
      updatedAt: '2026-08-05T00:00:00.000Z',
    }),
    drafts: [{
      contractId,
      paymentDueDay: 10,
      roomId: '00000000-0000-4000-8000-000000000002',
      tenantId: '00000000-0000-4000-8000-000000000003',
      contractCode: 'HD-101',
      roomNumber: '101',
      tenantName: 'Nguyễn Văn An',
      lines: [{
        chargeType: 'rent', label: 'Tiền phòng', sourceType: null, sourceId: null,
        quantity: 1, unitPrice: total, amount: total, metadata: {}, sortOrder: 0,
      }],
      subtotalAmount: total,
      discountAmount: 0,
      surchargeAmount: 0,
      totalAmount: total,
      blockers: [],
      warnings: [{ code: 'handover_fallback_used', message: 'Dùng chỉ số bàn giao' }],
      existingInvoiceId: null,
      existingInvoiceStatus: null,
    }],
    totals: { draftTotal: total, blockedDraftCount: 0, issuableDraftCount: 1 },
  }
}

const profile = {
  building_id: buildingId,
  bank_name: 'Vietcombank',
  account_holder: 'ZENO HOUSE',
  account_number: '0123456789',
  transfer_content_template: '{building_code} P{room_number} {invoice_code} {period}',
  qr_image_path: 'building/qr.png',
  logo_image_path: 'building/logo.png',
  legacy_backfilled_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-05T01:00:00.000Z',
  updated_by: 'user-1',
}

describe('BillingInvoiceIssueService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T03:00:00.000Z'))
    vi.stubGlobal('can', () => true)
    vi.stubGlobal('throwForbidden', (message: string) => { throw Object.assign(new Error(message), { statusCode: 403 }) })
    vi.stubGlobal('throwConflict', (message: string, details?: unknown) => {
      throw Object.assign(new Error(message), { statusCode: 409, data: { error: { code: 'CONFLICT', message, details } } })
    })
    calculateDraft.mockResolvedValue(draftResponse())
    findBuilding.mockResolvedValue({
      id: buildingId,
      code: 'ZENO',
      name: 'Zeno House',
      address: '1 Nguyễn Huệ',
      paymentDueDay: 15,
      gracePeriodDays: 2,
    })
    findProfile.mockResolvedValue(profile)
    signAsset.mockImplementation(async (_event, path: string) => `https://signed.test/${path}`)
    issueInvoices.mockResolvedValue({ issuedCount: 1, invoices: [] })
    findIssueReplay.mockResolvedValue(null)
  })

  afterEach(() => vi.useRealTimers())

  it('returns print-shaped draft documents with a server-owned operation and profile-bound hash', async () => {
    const { BillingInvoiceIssueService } = await import('../../../server/services/billing/invoice-issue-preview')
    const result = await BillingInvoiceIssueService.preview({} as never, user, periodId, {
      contract_ids: [contractId],
    })

    expect(result).toMatchObject({
      periodId,
      calculationDate: '2026-08-05',
      dueDateOverride: null,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      issuableCount: 1,
      totalAmount: 3_200_000,
      items: [{
        mode: 'draft',
        invoiceCode: null,
        roomNumber: '101',
        tenantName: 'Nguyễn Văn An',
        dueDate: '2026-08-10',
        gracePeriodDays: 2,
        overdueDate: '2026-08-12',
        totalAmount: 3_200_000,
        warnings: [{ code: 'handover_fallback_used', message: 'Dùng chỉ số bàn giao' }],
        invoiceProfile: {
          bankName: 'Vietcombank',
          transferContent: 'ZENO P101 MÃ CẤP KHI PHÁT HÀNH 08/2026',
          qrImageUrl: 'https://signed.test/building/qr.png',
          logoImageUrl: 'https://signed.test/building/logo.png',
        },
      }],
    })
  })

  it('rejects stale confirmation without issuing anything', async () => {
    const { BillingInvoiceIssueService } = await import('../../../server/services/billing/invoice-issue-preview')
    await expect(BillingInvoiceIssueService.confirm({} as never, user, periodId, {
      contract_ids: [contractId],
      due_date_override: '2026-08-09',
      snapshot_hash: 'a'.repeat(64),
      operation_id: operationId,
    })).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { reason: 'STALE_ISSUE_PREVIEW' } } },
    })
    expect(issueInvoices).not.toHaveBeenCalled()
  })

  it('issues from the already validated draft response with the preview operation id', async () => {
    const { BillingInvoiceIssueService } = await import('../../../server/services/billing/invoice-issue-preview')
    const preview = await BillingInvoiceIssueService.preview({} as never, user, periodId, {
      contract_ids: [contractId],
      due_date_override: '2026-08-09',
    })
    calculateDraft.mockClear()

    await BillingInvoiceIssueService.confirm({} as never, user, periodId, {
      contract_ids: [contractId],
      due_date_override: '2026-08-09',
      snapshot_hash: preview.snapshotHash,
      operation_id: operationId,
    })

    expect(calculateDraft).toHaveBeenCalledTimes(1)
    expect(issueInvoices).toHaveBeenCalledWith(expect.anything(), user, periodId, {
      contract_ids: [contractId],
      due_date_override: '2026-08-09',
      calculation_date: '2026-08-05',
      schedules_by_contract: {
        [contractId]: {
          dueDate: '2026-08-09',
          gracePeriodDays: 2,
          overdueDate: '2026-08-11',
          source: 'override',
        },
      },
    }, {
      operationId,
      draftResponse: expect.objectContaining({ period: expect.objectContaining({ id: periodId }) }),
    })
  })

  it('replays a completed operation before stale revalidation', async () => {
    const prior = { issuedCount: 1, invoices: [{ id: 'invoice-existing' }] }
    findIssueReplay.mockResolvedValueOnce(prior)
    const { BillingInvoiceIssueService } = await import('../../../server/services/billing/invoice-issue-preview')

    await expect(BillingInvoiceIssueService.confirm({} as never, user, periodId, {
      contract_ids: [contractId], due_date_override: '2026-08-09', snapshot_hash: 'a'.repeat(64), operation_id: operationId,
    })).resolves.toEqual(prior)

    expect(calculateDraft).not.toHaveBeenCalled()
    expect(issueInvoices).not.toHaveBeenCalled()
  })
})
