import PDFDocument from 'pdfkit'
import { chargeLineLabel } from '~/utils/billing/charge-groups'
import { formatMeterReading, formatViNumber } from '~/utils/billing/meter-display'
import type { InvoiceStatus } from '~/utils/constants/billing'
import type { InvoiceDocumentAssets, InvoiceDocumentData } from '../../types/invoice-email'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const PAGE_BOTTOM = 780
const LEFT = 42
const RIGHT = 553
const COLUMN_X = [48, 202, 266, 330, 390, 478] as const
const COLUMN_WIDTH = [148, 58, 58, 54, 82, 69] as const
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Nháp', issued: 'Đã phát hành', partial: 'Đã thu một phần', paid: 'Đã thanh toán', overdue: 'Quá hạn', void: 'Đã huỷ',
}

function safeFilenameToken(value: string): string {
  return value.normalize('NFKD').replaceAll(/[^\w.-]+/g, '-').replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '').toLowerCase()
}

export function invoicePdfFilename(invoiceCode: string): string {
  return `hoa-don-${safeFilenameToken(invoiceCode) || 'invoice'}.pdf`
}

function dateLabel(value: string | null): string {
  if (!value) return 'Không quy định'
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00+07:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(parsed)
}

function dueDateLabel(value: string | null): string {
  return value ? dateLabel(value) : '(Hạn 3 ngày).'
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function meterReading(charge: InvoiceDocumentData['charges'][number], key: string): string {
  if (charge.chargeType !== 'electricity' && charge.chargeType !== 'water') return ''
  return formatMeterReading(metadataNumber(charge.metadata, key))
}

function addOptionalImage(doc: PDFKit.PDFDocument, image: InvoiceDocumentAssets['qrImage'], x: number, y: number, fit: [number, number]) {
  if (!image || image.data.byteLength > MAX_IMAGE_BYTES) return
  try { doc.image(image.data, x, y, { fit }) } catch { /* Optional invoice imagery must not fail delivery. */ }
}

function addPageHeader(doc: PDFKit.PDFDocument, data: InvoiceDocumentData, assets: InvoiceDocumentAssets, continued = false) {
  addOptionalImage(doc, assets.logoImage, LEFT, 36, [88, 42])
  doc.fillColor('#475569').fontSize(8).text(data.buildingName, 138, 39, { width: 280, align: 'center' })
  doc.fillColor('#0f172a').fontSize(15).text(
    continued ? `PHIẾU TÍNH TIỀN NHÀ THÁNG ${data.periodLabel} (TIẾP THEO)` : `PHIẾU TÍNH TIỀN NHÀ THÁNG ${data.periodLabel}`,
    118,
    51,
    { width: 320, align: 'center' },
  )
  doc.fillColor('#64748b').fontSize(7).text(data.buildingAddress, 118, 70, { width: 320, align: 'center' })
  doc.roundedRect(458, 39, 95, 18, 3).fill('#0f172a')
  doc.fillColor('#ffffff').fontSize(8).text(data.invoiceCode, 462, 45, { width: 87, align: 'center' })
  doc.fillColor('#475569').fontSize(8).text(STATUS_LABELS[data.status], 458, 63, { width: 95, align: 'right' })
  doc.moveTo(LEFT, 88).lineTo(RIGHT, 88).strokeColor('#cbd5e1').stroke()
  doc.fillColor('#64748b').fontSize(8).text('Phòng & khách thuê', LEFT, 99)
  doc.fillColor('#0f172a').fontSize(9).text(`Phòng ${data.roomNumber} · ${data.tenantName}`, 128, 99, { width: 220 })
  doc.fillColor('#64748b').fontSize(8).text('Phát hành & hạn', 354, 99)
  doc.fillColor('#0f172a').fontSize(9).text(`${dateLabel(data.issuedAt)} — ${dueDateLabel(data.dueDate)}`, 423, 99, { width: 130, align: 'right' })
  doc.moveTo(LEFT, 119).lineTo(RIGHT, 119).strokeColor('#cbd5e1').stroke()
  doc.y = 130
}

function renderChargeHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y
  doc.rect(LEFT, y, RIGHT - LEFT, 20).fill('#f1f5f9')
  const labels = ['Nội dung', 'Chỉ số cũ', 'Chỉ số mới', 'Số lượng', 'Đơn giá', 'Thành tiền']
  labels.forEach((label, index) => {
    doc.fillColor('#64748b').fontSize(6.5).text(label, COLUMN_X[index], y + 7, {
      width: COLUMN_WIDTH[index], align: index === 0 ? 'left' : 'right',
    })
  })
  doc.y = y + 25
}

function renderCharges(doc: PDFKit.PDFDocument, data: InvoiceDocumentData, assets: InvoiceDocumentAssets) {
  renderChargeHeader(doc)
  for (const charge of data.charges) {
    const label = chargeLineLabel(charge.chargeType, charge.label)
    const labelHeight = doc.heightOfString(label, { width: COLUMN_WIDTH[0] })
    const rowHeight = Math.max(22, labelHeight + 9)
    if (doc.y + rowHeight > PAGE_BOTTOM) {
      doc.addPage()
      addPageHeader(doc, data, assets, true)
      renderChargeHeader(doc)
    }
    const y = doc.y
    const values = [
      label,
      meterReading(charge, 'previous_reading_value'),
      meterReading(charge, 'current_reading_value'),
      formatViNumber(charge.quantity),
      money.format(charge.unitPrice),
      money.format(charge.amount),
    ]
    values.forEach((value, index) => {
      doc.fillColor(index === 0 || index === 5 ? '#0f172a' : '#475569').fontSize(index === 0 ? 8.5 : 7.5)
        .text(value, COLUMN_X[index], y + 5, { width: COLUMN_WIDTH[index], align: index === 0 ? 'left' : 'right' })
    })
    doc.moveTo(LEFT, y + rowHeight).lineTo(RIGHT, y + rowHeight).strokeColor('#e2e8f0').stroke()
    doc.y = y + rowHeight
  }
}

function renderFooter(doc: PDFKit.PDFDocument, data: InvoiceDocumentData, assets: InvoiceDocumentAssets) {
  if (doc.y > 570) {
    doc.addPage()
    addPageHeader(doc, data, assets, true)
  }
  const start = doc.y + 18
  const totals = [
    ['Đã thu', data.paidAmount],
    ['Còn lại', data.balanceAmount],
    ['Tổng tiền', data.totalAmount],
  ] as const
  totals.forEach(([label, value], index) => {
    const strong = index === totals.length - 1
    doc.fillColor(strong ? '#0f172a' : '#64748b').fontSize(strong ? 13 : 9)
      .text(label, 380, start + index * 19, { width: 75 })
      .text(money.format(value), 455, start + index * 19, { width: 98, align: 'right' })
  })
  doc.moveTo(380, start + 34).lineTo(RIGHT, start + 34).strokeColor('#0f172a').stroke()
  const paymentY = start + 78
  doc.fillColor('#0f172a').fontSize(10).text('Thông tin chuyển khoản', LEFT, paymentY)
  if (data.paymentProfile) {
    const profile = data.paymentProfile
    doc.fillColor('#64748b').fontSize(8)
      .text('Người thụ hưởng', LEFT, paymentY + 18)
      .text('Số tài khoản', LEFT, paymentY + 34)
      .text('Ngân hàng', LEFT, paymentY + 50)
      .text('Nội dung', LEFT, paymentY + 66)
    doc.fillColor('#0f172a').fontSize(9)
      .text(profile.accountHolder, 118, paymentY + 18, { width: 220 })
      .text(profile.accountNumber, 118, paymentY + 34, { width: 220 })
      .text(profile.bankName, 118, paymentY + 50, { width: 220 })
      .text(profile.transferContent, 118, paymentY + 66, { width: 220 })
    addOptionalImage(doc, assets.qrImage, 430, paymentY + 13, [92, 92])
  }
  else {
    doc.fillColor('#64748b').fontSize(9).text('Liên hệ quản lý để nhận thông tin thanh toán.', LEFT, paymentY + 20)
  }
  doc.roundedRect(LEFT, paymentY + 104, 345, 28, 3).fill('#fffbeb')
  doc.fillColor('#92400e').fontSize(7.5).text(
    'Vui lòng thanh toán trước hạn thanh toán để tránh những phát sinh chi phí của việc chậm thanh toán.',
    LEFT + 8,
    paymentY + 112,
    { width: 328 },
  )
  if (data.notes) doc.fillColor('#64748b').fontSize(7.5).text(`Ghi chú: ${data.notes}`, LEFT, paymentY + 140, { width: RIGHT - LEFT })
}

export async function renderInvoicePdf(data: InvoiceDocumentData, assets: InvoiceDocumentAssets): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margins: { top: 40, right: 42, bottom: 42, left: 42 },
      info: { Title: `Hoá đơn ${data.invoiceCode}`, Author: 'Zeno House', Subject: `Phiếu tính tiền nhà tháng ${data.periodLabel}` },
      bufferPages: true,
    })
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)))
    doc.on('error', reject)
    doc.on('end', () => {
      const output = Buffer.concat(chunks)
      if (output.byteLength > MAX_PDF_BYTES) { reject(new Error('INVOICE_PDF_TOO_LARGE')); return }
      resolve(output)
    })
    try {
      doc.registerFont('Inter', assets.font)
      doc.font('Inter')
      addPageHeader(doc, data, assets)
      renderCharges(doc, data, assets)
      renderFooter(doc, data, assets)
      doc.end()
    }
    catch (error) {
      doc.removeAllListeners()
      reject(error)
    }
  })
}
