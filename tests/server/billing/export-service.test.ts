import ExcelJS from 'exceljs'
import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const periodFindById = vi.fn()
const invoiceListByPeriod = vi.fn()
const invoiceListCharges = vi.fn()
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
    listCharges: invoiceListCharges,
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
    invoiceListCharges.mockResolvedValue([
      { chargeType: 'rent', amount: 2_000_000, metadata: {} },
      {
        chargeType: 'electricity',
        amount: 300_000,
        metadata: { previous_reading_value: 10, current_reading_value: 30 },
      },
      { chargeType: 'water', amount: 200_000, metadata: {} },
    ])
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
  })
})
