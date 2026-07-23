import PDFDocument from 'pdfkit'
import type {
  InvoiceDocumentAssets,
  InvoiceDocumentData,
} from '../../types/invoice-email'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const PAGE_BOTTOM = 780
const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

function safeFilenameToken(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[^\w.-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase()
}

export function invoicePdfFilename(invoiceCode: string): string {
  return `hoa-don-${safeFilenameToken(invoiceCode) || 'invoice'}.pdf`
}

function dateLabel(value: string | null): string {
  if (!value) return 'Không quy định'
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00+07:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(parsed)
}

function addPageHeader(doc: PDFKit.PDFDocument, data: InvoiceDocumentData, continued = false) {
  doc.fillColor('#0f172a').fontSize(19).text(
    continued ? `Hoá đơn ${data.invoiceCode} (tiếp theo)` : `HOÁ ĐƠN ${data.invoiceCode}`,
    42,
    40,
  )
  doc.fontSize(10).fillColor('#475569')
    .text(`${data.buildingName} · Phòng ${data.roomNumber} · Kỳ ${data.periodLabel}`, 42, 68)
  doc.moveTo(42, 88).lineTo(553, 88).strokeColor('#cbd5e1').stroke()
  doc.y = 104
}

function renderChargeHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y
  doc.rect(42, y, 511, 22).fill('#e2e8f0')
  doc.fillColor('#0f172a').fontSize(9)
    .text('Khoản thu', 48, y + 6, { width: 245 })
    .text('SL', 300, y + 6, { width: 45, align: 'right' })
    .text('Đơn giá', 352, y + 6, { width: 88, align: 'right' })
    .text('Thành tiền', 447, y + 6, { width: 100, align: 'right' })
  doc.y = y + 27
}

export async function renderInvoicePdf(
  data: InvoiceDocumentData,
  assets: InvoiceDocumentAssets,
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, right: 42, bottom: 42, left: 42 },
      info: {
        Title: `Hoá đơn ${data.invoiceCode}`,
        Author: 'Zeno House',
        Subject: `Hoá đơn kỳ ${data.periodLabel}`,
      },
      bufferPages: true,
    })
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)))
    doc.on('error', reject)
    doc.on('end', () => {
      const output = Buffer.concat(chunks)
      if (output.byteLength > MAX_PDF_BYTES) {
        reject(new Error('INVOICE_PDF_TOO_LARGE'))
        return
      }
      resolve(output)
    })

    try {
      doc.registerFont('Inter', assets.font)
      doc.font('Inter')
      addPageHeader(doc, data)

      if (assets.logoImage && assets.logoImage.byteLength <= MAX_IMAGE_BYTES) {
        try {
          doc.image(assets.logoImage, 465, 38, { fit: [88, 42], align: 'right' })
        }
        catch {
          // Optional branding must not make invoice delivery fail.
        }
      }

      doc.fillColor('#0f172a').fontSize(10)
        .text(`Khách thuê: ${data.tenantName}`, 42, 104)
        .text(`Địa chỉ: ${data.buildingAddress}`, 42, 121, { width: 330 })
        .text(`Ngày phát hành: ${dateLabel(data.issuedAt)}`, 388, 104, { width: 165, align: 'right' })
        .text(`Hạn thanh toán: ${dateLabel(data.dueDate)}`, 388, 121, { width: 165, align: 'right' })
      doc.y = 155

      renderChargeHeader(doc)
      for (const charge of data.charges) {
        const labelHeight = doc.heightOfString(charge.label, { width: 245 })
        const rowHeight = Math.max(22, labelHeight + 10)
        if (doc.y + rowHeight > PAGE_BOTTOM) {
          doc.addPage()
          addPageHeader(doc, data, true)
          renderChargeHeader(doc)
        }
        const y = doc.y
        doc.fillColor('#1e293b').fontSize(9)
          .text(charge.label, 48, y + 5, { width: 245 })
          .text(String(charge.quantity), 300, y + 5, { width: 45, align: 'right' })
          .text(money.format(charge.unitPrice), 352, y + 5, { width: 88, align: 'right' })
          .text(money.format(charge.amount), 447, y + 5, { width: 100, align: 'right' })
        doc.moveTo(42, y + rowHeight).lineTo(553, y + rowHeight).strokeColor('#e2e8f0').stroke()
        doc.y = y + rowHeight
      }

      if (doc.y > 615) {
        doc.addPage()
        addPageHeader(doc, data, true)
      }

      const totalsY = doc.y + 18
      const totals = [
        ['Tạm tính', data.subtotalAmount],
        ...(data.discountAmount !== 0 ? [['Giảm trừ', -data.discountAmount] as const] : []),
        ...(data.surchargeAmount !== 0 ? [['Phụ thu', data.surchargeAmount] as const] : []),
        ['Tổng cộng', data.totalAmount],
        ['Đã thu', data.paidAmount],
        ['Còn lại', data.balanceAmount],
      ] as const
      totals.forEach(([label, value], index) => {
        const strong = index >= totals.length - 2
        doc.fillColor(strong ? '#0f172a' : '#475569').fontSize(strong ? 11 : 9)
          .text(label, 325, totalsY + index * 18, { width: 90 })
          .text(money.format(value), 418, totalsY + index * 18, { width: 135, align: 'right' })
      })

      doc.fillColor('#0f172a').fontSize(11).text('Thông tin thanh toán', 42, totalsY)
      if (data.paymentProfile) {
        const profile = data.paymentProfile
        doc.fillColor('#334155').fontSize(9)
          .text(`Ngân hàng: ${profile.bankName}`, 42, totalsY + 22, { width: 250 })
          .text(`Chủ tài khoản: ${profile.accountHolder}`, 42, totalsY + 39, { width: 250 })
          .text(`Số tài khoản: ${profile.accountNumber}`, 42, totalsY + 56, { width: 250 })
          .text(`Nội dung: ${profile.transferContent}`, 42, totalsY + 73, { width: 250 })
        if (assets.qrImage && assets.qrImage.byteLength <= MAX_IMAGE_BYTES) {
          try {
            doc.image(assets.qrImage, 208, totalsY + 18, { fit: [82, 82], align: 'right' })
          }
          catch {
            // The stored snapshot remains authoritative; malformed optional
            // image bytes fall back to the textual transfer instructions.
          }
        }
      }
      else {
        doc.fillColor('#475569').fontSize(9)
          .text('Vui lòng liên hệ ban quản lý để được hướng dẫn thanh toán.', 42, totalsY + 22, { width: 250 })
      }

      if (data.notes) {
        doc.fillColor('#475569').fontSize(8)
          .text(`Ghi chú: ${data.notes}`, 42, Math.min(PAGE_BOTTOM - 34, totalsY + 126), { width: 511 })
      }
      doc.end()
    }
    catch (error) {
      doc.removeAllListeners()
      reject(error)
    }
  })
}
