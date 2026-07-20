import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findManyByIdentifiers = vi.fn()
const listChargesByInvoiceIds = vi.fn()
const findManyPeriods = vi.fn()
const findManyBuildings = vi.fn()
const enrichInvoices = vi.fn(async invoices => invoices)
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()
const newCorrelationId = vi.fn(() => 'print-correlation')

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: { findManyByIdentifiers, listChargesByInvoiceIds },
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findManyByIds: findManyPeriods },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findManyByIds: findManyBuildings },
}))

vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return { enrichInvoices }
  }),
}))

vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: { append: appendAudit },
}))
vi.mock('../../../server/utils/billing/correlation', () => ({ newCorrelationId }))

const admin = { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser

function event() {
  return { context: {} } as never
}

function building(id: string, name: string) {
  return { id, name, address: `${name} address` }
}

describe('invoicePrintRequestSchema', () => {
  it('accepts 1 to 100 invoice UUIDs and rejects larger or empty batches', async () => {
    const { invoicePrintRequestSchema } = await import('../../../app/utils/validators/invoices')
    const ids = Array.from({ length: 100 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    )

    expect(invoicePrintRequestSchema.safeParse({ invoice_ids: ids }).success).toBe(true)
    expect(invoicePrintRequestSchema.safeParse({ invoice_ids: [] }).success).toBe(false)
    expect(invoicePrintRequestSchema.safeParse({ invoice_ids: [...ids, ids[0]] }).success).toBe(false)
    expect(invoicePrintRequestSchema.safeParse({ invoice_ids: ['not-a-uuid'] }).success).toBe(false)
  })
})

describe('InvoicePrintService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', () => true)
    assertBuildingScope.mockResolvedValue(undefined)
    appendAudit.mockResolvedValue(undefined)
  })

  it('deduplicates in request order and batch-loads invoice snapshots', async () => {
    const invoice1 = buildInvoice({ id: 'invoice-1', billingPeriodId: 'period-1' })
    const invoice2 = buildInvoice({ id: 'invoice-2', billingPeriodId: 'period-2' })
    findManyByIdentifiers.mockResolvedValue([invoice1, invoice2])
    findManyPeriods.mockResolvedValue([
      buildPeriod({ id: 'period-1', buildingId: 'building-1' }),
      buildPeriod({ id: 'period-2', buildingId: 'building-2', periodMonth: 6 }),
    ])
    findManyBuildings.mockResolvedValue([
      building('building-1', 'Nhà Một'),
      building('building-2', 'Nhà Hai'),
    ])
    listChargesByInvoiceIds.mockResolvedValue(new Map([
      ['invoice-1', [{ id: 'charge-1', invoiceId: 'invoice-1' }]],
      ['invoice-2', [{ id: 'charge-2', invoiceId: 'invoice-2' }]],
    ]))
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    const result = await InvoicePrintService.getPrintData(
      event(), admin, ['invoice-2', 'invoice-1', 'invoice-2'],
    )

    expect(result.map(item => item.invoice.id)).toEqual(['invoice-2', 'invoice-1'])
    expect(result.map(item => item.invoice.status)).toEqual(['overdue', 'overdue'])
    expect(result[0]).toMatchObject({
      building: { id: 'building-2', name: 'Nhà Hai' },
      period: { id: 'period-2', periodMonth: 6 },
      charges: [{ id: 'charge-2' }],
    })
    expect(findManyByIdentifiers).toHaveBeenCalledTimes(1)
    expect(findManyPeriods).toHaveBeenCalledTimes(1)
    expect(findManyBuildings).toHaveBeenCalledTimes(1)
    expect(listChargesByInvoiceIds).toHaveBeenCalledTimes(1)
    expect(enrichInvoices).toHaveBeenCalledTimes(1)
    expect(assertBuildingScope).toHaveBeenCalledTimes(2)
  })

  it('rejects the entire batch when an invoice is missing', async () => {
    findManyByIdentifiers.mockResolvedValue([buildInvoice({ id: 'invoice-1' })])
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    await expect(InvoicePrintService.getPrintData(event(), admin, ['invoice-1', 'invoice-2']))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(findManyPeriods).not.toHaveBeenCalled()
  })

  it('rejects the entire batch when an invoice is void', async () => {
    findManyByIdentifiers.mockResolvedValue([buildInvoice({ id: 'invoice-1', status: 'void' })])
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    await expect(InvoicePrintService.getPrintData(event(), admin, ['invoice-1']))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(findManyPeriods).not.toHaveBeenCalled()
  })

  it('rejects the entire batch when an invoice is still draft', async () => {
    findManyByIdentifiers.mockResolvedValue([buildInvoice({ id: 'invoice-1', status: 'draft' })])
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    await expect(InvoicePrintService.getPrintData(event(), admin, ['invoice-1']))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(findManyPeriods).not.toHaveBeenCalled()
  })

  it('requires billing.read before loading invoices', async () => {
    vi.stubGlobal('can', () => false)
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    await expect(InvoicePrintService.getPrintData(event(), admin, ['invoice-1']))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(findManyByIdentifiers).not.toHaveBeenCalled()
  })

  it('fails when any invoice building is outside read scope', async () => {
    const invoice = buildInvoice({ id: 'invoice-1', billingPeriodId: 'period-1' })
    findManyByIdentifiers.mockResolvedValue([invoice])
    findManyPeriods.mockResolvedValue([buildPeriod({ id: 'period-1', buildingId: 'building-2' })])
    findManyBuildings.mockResolvedValue([building('building-2', 'Nhà Hai')])
    assertBuildingScope.mockRejectedValueOnce({ statusCode: 403 })
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    await expect(InvoicePrintService.getPrintData(event(), admin, ['invoice-1']))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(listChargesByInvoiceIds).not.toHaveBeenCalled()
  })

  it('records one audit event per unique invoice with its period and one correlation', async () => {
    const invoice1 = buildInvoice({ id: 'invoice-1', billingPeriodId: 'period-1' })
    const invoice2 = buildInvoice({ id: 'invoice-2', billingPeriodId: 'period-2' })
    findManyByIdentifiers.mockResolvedValue([invoice1, invoice2])
    findManyPeriods.mockResolvedValue([
      buildPeriod({ id: 'period-1', buildingId: 'building-1' }),
      buildPeriod({ id: 'period-2', buildingId: 'building-2' }),
    ])
    findManyBuildings.mockResolvedValue([
      building('building-1', 'Nhà Một'),
      building('building-2', 'Nhà Hai'),
    ])
    listChargesByInvoiceIds.mockResolvedValue(new Map())
    const { InvoicePrintService } = await import('../../../server/services/billing/invoice-print')

    const result = await InvoicePrintService.recordPrinted(
      event(), admin, ['invoice-2', 'invoice-1', 'invoice-2'],
    )

    expect(result).toEqual({ printed: 2 })
    expect(appendAudit).toHaveBeenCalledTimes(2)
    expect(appendAudit).toHaveBeenNthCalledWith(1, expect.anything(), admin, expect.objectContaining({
      billing_period_id: 'period-2',
      entity_id: 'invoice-2',
      correlation_id: 'print-correlation',
      metadata: { invoice_id: 'invoice-2', format: 'print' },
    }))
    expect(appendAudit).toHaveBeenNthCalledWith(2, expect.anything(), admin, expect.objectContaining({
      billing_period_id: 'period-1',
      entity_id: 'invoice-1',
      correlation_id: 'print-correlation',
    }))
    expect(newCorrelationId).toHaveBeenCalledTimes(1)
  })
})
