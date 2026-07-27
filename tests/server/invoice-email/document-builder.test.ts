import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const mocks = vi.hoisted(() => ({
  findInvoice: vi.fn(),
  findPeriod: vi.fn(),
  findBuildings: vi.fn(),
  listCharges: vi.fn(),
  loadTenants: vi.fn(),
  loadRooms: vi.fn(),
  findSnapshots: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    findById: mocks.findInvoice,
    listCharges: mocks.listCharges,
  },
}))
vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findById: mocks.findPeriod },
}))
vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findManyByIds: mocks.findBuildings },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: {
    findInvoiceSnapshotsByIds: mocks.findSnapshots,
  },
}))
vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return {
      loadTenants: mocks.loadTenants,
      loadRooms: mocks.loadRooms,
    }
  }),
}))

describe('InvoiceEmailDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findInvoice.mockResolvedValue(buildInvoice({
      id: 'invoice-1',
      invoiceCode: 'INV-1',
      billingPeriodId: 'period-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      status: 'partial',
      paidAmount: 1_000_000,
      balanceAmount: 2_500_000,
    }))
    mocks.findPeriod.mockResolvedValue(buildPeriod({
      id: 'period-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
    }))
    mocks.findBuildings.mockResolvedValue([{
      id: 'building-1',
      name: 'Zeno House',
      address: '12 Nguyễn Huệ',
    }])
    mocks.listCharges.mockResolvedValue([{
      chargeType: 'electricity',
      label: 'Tiền điện',
      quantity: 125,
      unitPrice: 3_500,
      amount: 437_500,
      metadata: { previous_reading_value: 100, current_reading_value: 225 },
    }])
    mocks.loadTenants.mockResolvedValue(new Map([
      ['tenant-1', { id: 'tenant-1', fullName: 'Nguyễn Văn An' }],
    ]))
    mocks.loadRooms.mockResolvedValue(new Map([
      ['room-1', { id: 'room-1', roomNumber: '401' }],
    ]))
    mocks.findSnapshots.mockResolvedValue(new Map([
      ['invoice-1', {
        schema_version: 1,
        bank_name: 'VIB',
        account_holder: 'ZENO HOUSE',
        account_number: '123456789',
        transfer_content: 'INV-1 401',
        qr_image_path: 'building-1/qr/snapshot.webp',
        logo_image_path: 'building-1/logo/snapshot.webp',
        snapshotted_at: '2026-07-20T01:00:00.000Z',
      }],
    ]))
  })

  it('builds one server-only render model from persisted invoice data and snapshots', async () => {
    const { InvoiceEmailDocumentService } = await import(
      '../../../server/services/invoice-email/document'
    )

    const result = await InvoiceEmailDocumentService.build(
      { context: {} } as never,
      'invoice-1',
    )

    expect(result).toMatchObject({
      invoiceCode: 'INV-1',
      periodLabel: '07/2026',
      buildingName: 'Zeno House',
      roomNumber: '401',
      tenantName: 'Nguyễn Văn An',
      paidAmount: 1_000_000,
      balanceAmount: 2_500_000,
      charges: [{
        chargeType: 'electricity',
        label: 'Tiền điện',
        metadata: { previous_reading_value: 100, current_reading_value: 225 },
      }],
      paymentProfile: {
        bankName: 'VIB',
        qrImagePath: 'building-1/qr/snapshot.webp',
        snapshottedAt: '2026-07-20T01:00:00.000Z',
      },
    })
  })

  it('preserves print charge type and derives the current display status', async () => {
    mocks.findInvoice.mockResolvedValue(buildInvoice({
      id: 'invoice-1',
      status: 'issued',
      dueDate: '2026-07-01',
      balanceAmount: 1,
    }))
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'))
    const { InvoiceEmailDocumentService } = await import(
      '../../../server/services/invoice-email/document'
    )

    const result = await InvoiceEmailDocumentService.build({ context: {} } as never, 'invoice-1')

    expect(result.status).toBe('overdue')
    expect(result.charges[0]).toMatchObject({ chargeType: 'electricity' })
    vi.useRealTimers()
  })

  it('rejects void invoices before loading child data', async () => {
    mocks.findInvoice.mockResolvedValue(buildInvoice({
      id: 'invoice-1',
      status: 'void',
    }))
    const { InvoiceEmailDocumentService } = await import(
      '../../../server/services/invoice-email/document'
    )

    await expect(InvoiceEmailDocumentService.build(
      { context: {} } as never,
      'invoice-1',
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.listCharges).not.toHaveBeenCalled()
  })
})
