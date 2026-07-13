import ExcelJS from 'exceljs'
import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const periodFindById = vi.fn()
const invoiceListByPeriod = vi.fn()
const invoiceListChargesByInvoiceIds = vi.fn()
const enrichInvoices = vi.fn()
const appendAudit = vi.fn()
const assertBuildingScope = vi.fn()
const dbFrom = vi.fn()
const dbSelect = vi.fn()
const dbEq = vi.fn()
const dbMaybeSingle = vi.fn()
const canMock = vi.fn()

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findById: periodFindById },
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    listByPeriod: invoiceListByPeriod,
    listChargesByInvoiceIds: invoiceListChargesByInvoiceIds,
  },
}))

vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return { enrichInvoices }
  }),
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: { append: appendAudit },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/utils/db', () => ({
  db: () => ({
    from: dbFrom,
  }),
}))

const admin = { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser

describe('BillingExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', canMock)
    canMock.mockReturnValue(true)
    periodFindById.mockResolvedValue({
      id: 'period-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 6,
    })
    dbFrom.mockReturnValue({ select: dbSelect })
    dbSelect.mockReturnValue({ eq: dbEq })
    dbEq.mockReturnValue({ maybeSingle: dbMaybeSingle })
    dbMaybeSingle.mockResolvedValue({ data: { name: 'Nhà Mẫu' }, error: null })
    invoiceListByPeriod.mockResolvedValue([{ id: 'invoice-1' }])
    enrichInvoices.mockResolvedValue([
      {
        id: 'invoice-1',
        status: 'issued',
        roomNumber: '101',
        totalAmount: 2_500_000,
      },
    ])
    invoiceListChargesByInvoiceIds.mockResolvedValue(new Map([['invoice-1', [
      { invoiceId: 'invoice-1', chargeType: 'rent', amount: 2_000_000, metadata: {} },
      {
        invoiceId: 'invoice-1',
        chargeType: 'electricity',
        amount: 300_000,
        metadata: { previous_reading_value: 10, current_reading_value: 30 },
      },
      { invoiceId: 'invoice-1', chargeType: 'water', amount: 200_000, metadata: {} },
    ]]]))
    assertBuildingScope.mockResolvedValue(undefined)
    appendAudit.mockResolvedValue(undefined)
  })

  it('preserves filename, scope check, audit and workbook shape', async () => {
    const { BillingExportService } = await import('../../../server/services/billing/export')

    const result = await BillingExportService.buildPeriodWorkbook({} as never, admin, 'period-1')

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), admin, 'building-1', 'read')
    expect(result.fileName).toBe('billing-nha-mau-2026-06.xlsx')
    expect(result.buffer.length).toBeGreaterThan(0)
    expect(appendAudit).toHaveBeenCalledWith(
      expect.anything(),
      admin,
      expect.objectContaining({
        billing_period_id: 'period-1',
        entity_type: 'billing_period',
        entity_id: 'period-1',
        metadata: { format: 'xlsx', invoice_count: 1 },
      }),
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    expect(workbook.worksheets).toHaveLength(1)
    expect(workbook.worksheets[0]?.rowCount).toBeGreaterThan(4)
    expect(invoiceListChargesByInvoiceIds).toHaveBeenCalledTimes(1)
    expect(invoiceListChargesByInvoiceIds).toHaveBeenCalledWith(expect.anything(), ['invoice-1'])
  })

  it('batch-loads charges once as the invoice count grows', async () => {
    invoiceListByPeriod.mockResolvedValue([
      { id: 'invoice-1' },
      { id: 'invoice-2' },
      { id: 'invoice-3' },
    ])
    enrichInvoices.mockResolvedValue([
      { id: 'invoice-1', status: 'issued', roomNumber: '101', totalAmount: 2_500_000 },
      { id: 'invoice-2', status: 'issued', roomNumber: '102', totalAmount: 2_600_000 },
      { id: 'invoice-3', status: 'issued', roomNumber: '103', totalAmount: 2_700_000 },
    ])
    invoiceListChargesByInvoiceIds.mockResolvedValue(new Map([
      ['invoice-1', []],
      ['invoice-2', []],
      ['invoice-3', []],
    ]))

    const { BillingExportService } = await import('../../../server/services/billing/export')
    await BillingExportService.buildPeriodWorkbook({} as never, admin, 'period-1')

    expect(invoiceListChargesByInvoiceIds).toHaveBeenCalledTimes(1)
    expect(invoiceListChargesByInvoiceIds).toHaveBeenCalledWith(
      expect.anything(),
      ['invoice-1', 'invoice-2', 'invoice-3'],
    )
  })
})
