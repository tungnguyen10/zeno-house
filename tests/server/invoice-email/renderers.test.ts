import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { InvoiceDocumentData } from '../../../server/types/invoice-email'
import {
  invoiceEmailSubject,
  renderInvoiceEmailHtml,
} from '../../../server/services/invoice-email/html'
import {
  invoicePdfFilename,
  renderInvoicePdf,
} from '../../../server/services/invoice-email/pdf'

function documentData(overrides: Partial<InvoiceDocumentData> = {}): InvoiceDocumentData {
  return {
    invoiceId: 'invoice-1',
    invoiceCode: 'INV-2026-07-0001',
    status: 'partial',
    issuedAt: '2026-07-20T02:00:00.000Z',
    dueDate: '2026-07-30',
    periodLabel: '07/2026',
    buildingName: 'Zeno House',
    buildingAddress: '12 Nguyễn Huệ, Quận 1',
    roomNumber: 'P.401',
    tenantName: 'Nguyễn Văn An',
    subtotalAmount: 3_000_000,
    discountAmount: 100_000,
    surchargeAmount: 50_000,
    totalAmount: 2_950_000,
    paidAmount: 1_000_000,
    balanceAmount: 1_950_000,
    notes: null,
    charges: [{
      chargeType: 'electricity',
      label: 'Tiền điện tháng 7',
      quantity: 125,
      unitPrice: 3_500,
      amount: 437_500,
      metadata: { previous_reading_value: 100, current_reading_value: 225 },
    }],
    paymentProfile: {
      bankName: 'Ngân hàng Á Châu',
      accountHolder: 'CÔNG TY ZENO',
      accountNumber: '123456789',
      transferContent: 'INV-2026-07-0001 P.401',
      qrImagePath: 'building/qr/code.png',
      logoImagePath: null,
      snapshottedAt: '2026-07-20T02:00:00.000Z',
    },
    ...overrides,
  }
}

describe('invoice email HTML renderer', () => {
  it('renders Vietnamese totals and snapshotted payment instructions', () => {
    const data = documentData()
    const html = renderInvoiceEmailHtml(data)

    expect(invoiceEmailSubject(data)).toBe('Hoá đơn INV-2026-07-0001 – Zeno House')
    expect(html).toContain('Nguyễn Văn An')
    expect(html).toContain('Điện')
    expect(html).toContain('1.950.000')
    expect(html).toContain('Ngân hàng Á Châu')
    expect(html).toContain('INV-2026-07-0001 P.401')
    expect(html).toContain('Chỉ số cũ')
    expect(html).toContain('Chỉ số mới')
    expect(html).toContain('100')
    expect(html).toContain('225')
    expect(html).toContain('Thu một phần')
  })

  it('escapes stored and operator-controlled content', () => {
    const html = renderInvoiceEmailHtml(documentData({
      tenantName: '<img src=x onerror=alert(1)>',
      charges: [{
        chargeType: 'service',
        label: '<script>alert(1)</script>',
        quantity: 1,
        unitPrice: 1,
        amount: 1,
        metadata: {},
      }],
    }))

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
  })

  it('uses neutral payment copy when the immutable profile snapshot is missing', () => {
    const html = renderInvoiceEmailHtml(documentData({ paymentProfile: null }))
    expect(html).toContain('Liên hệ quản lý để nhận thông tin thanh toán')
  })

  it('keeps transfer instructions usable when the QR asset is unavailable', () => {
    const html = renderInvoiceEmailHtml(documentData(), {
      font: Buffer.from('font'),
      logoImage: null,
      qrImage: null,
    })

    expect(html).toContain('Nếu email không hiển thị mã QR, vui lòng dùng đúng thông tin chuyển khoản bên cạnh.')
    expect(html).toContain('Dùng thông tin chuyển khoản để nhập thủ công')
  })

  it('uses the print due-date fallback when an invoice has no explicit due date', () => {
    const html = renderInvoiceEmailHtml(documentData({ dueDate: null }))

    expect(html).toContain('(Hạn 4 ngày).')
  })

  it('embeds validated logo and QR assets as inline base64 data URIs', () => {
    const html = renderInvoiceEmailHtml(documentData(), {
      font: Buffer.from('font'),
      logoImage: {
        data: Buffer.from('logo'), contentType: 'image/png', filename: 'logo.png', cid: 'invoice-building-logo',
      },
      qrImage: {
        data: Buffer.from('qr'), contentType: 'image/png', filename: 'qr.png', cid: 'invoice-payment-qr',
      },
    })

    expect(html).toContain(`data:image/png;base64,${Buffer.from('logo').toString('base64')}`)
    expect(html).toContain(`data:image/png;base64,${Buffer.from('qr').toString('base64')}`)
    expect(html).not.toContain('cid:')
    expect(html).not.toContain('building/qr/code.png')
  })
})

describe('invoice PDF renderer', () => {
  const font = readFileSync(
    resolve(process.cwd(), 'server/assets/invoice-email/Inter[opsz,wght].ttf'),
  )

  it('renders a Vietnamese A4 PDF with a deterministic safe filename', async () => {
    const pdf = await renderInvoicePdf(documentData(), {
      font,
      qrImage: null,
      logoImage: null,
    })

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(3_000)
    expect(invoicePdfFilename('INV 2026/07 #001')).toBe('hoa-don-inv-2026-07-001.pdf')
  })

  it('continues long charge tables onto additional pages without truncation', async () => {
    const charges = Array.from({ length: 80 }, (_, index) => ({
      chargeType: 'service' as const,
      label: `Khoản thu dài số ${index + 1}: điện, nước và dịch vụ`,
      quantity: index + 1,
      unitPrice: 3_500,
      amount: (index + 1) * 3_500,
      metadata: {},
    }))
    const pdf = await renderInvoicePdf(documentData({ charges }), {
      font,
      qrImage: {
        data: Buffer.from('corrupt optional qr image'), contentType: 'image/png', filename: 'qr.png', cid: 'qr',
      },
      logoImage: {
        data: Buffer.from('corrupt optional logo image'), contentType: 'image/png', filename: 'logo.png', cid: 'logo',
      },
    })

    const source = pdf.toString('latin1')
    expect(source.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThan(1)
    expect(pdf.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024)
  })

  it('uses the print hierarchy and six charge columns in the generated document', async () => {
    const pdf = await renderInvoicePdf(documentData(), {
      font,
      qrImage: null,
      logoImage: null,
    })

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(3_000)
  })
})
