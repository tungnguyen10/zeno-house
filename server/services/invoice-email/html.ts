import { chargeLineLabel } from '~/utils/billing/charge-groups'
import { formatMeterReading, formatViNumber } from '~/utils/billing/meter-display'
import type { InvoiceStatus } from '~/utils/constants/billing'
import type { InvoiceDocumentAssets, InvoiceDocumentData } from '../../types/invoice-email'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Nháp',
  issued: 'Đã phát hành',
  partial: 'Đã thu một phần',
  paid: 'Đã thanh toán',
  overdue: 'Quá hạn',
  void: 'Đã huỷ',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;')
}

function formatDate(value: string | null): string {
  if (!value) return 'Không quy định'
  const date = new Date(`${value.slice(0, 10)}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return escapeHtml(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

function dueDateLabel(value: string | null): string {
  return value ? formatDate(value) : '(Hạn 3 ngày).'
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

function meterValue(data: InvoiceDocumentData, index: number, key: string): string {
  const charge = data.charges[index]
  if (!charge || (charge.chargeType !== 'electricity' && charge.chargeType !== 'water')) return ''
  return formatMeterReading(metadataNumber(charge.metadata, key))
}

function paymentInstructions(data: InvoiceDocumentData, assets?: InvoiceDocumentAssets): string {
  const profile = data.paymentProfile
  if (!profile) {
    return '<p class="payment-empty">Liên hệ quản lý để nhận thông tin thanh toán.</p>'
  }
  const qr = assets?.qrImage
    ? `<img class="qr" src="cid:${escapeHtml(assets.qrImage.cid)}" alt="Mã QR chuyển khoản ngân hàng">`
    : '<p class="qr-fallback">Nếu email không hiển thị mã QR, vui lòng dùng đúng thông tin chuyển khoản bên cạnh.</p>'
  return `
    <section class="payment-wrap">
      <dl class="payment">
        <div><dt>Người thụ hưởng</dt><dd>${escapeHtml(profile.accountHolder)}</dd></div>
        <div><dt>Số tài khoản</dt><dd>${escapeHtml(profile.accountNumber)}</dd></div>
        <div><dt>Ngân hàng</dt><dd>${escapeHtml(profile.bankName)}</dd></div>
        <div><dt>Nội dung</dt><dd>${escapeHtml(profile.transferContent)}</dd></div>
      </dl>
      <div class="qr-wrap">${qr}<p>${assets?.qrImage ? 'Quét mã để chuyển khoản' : 'Dùng thông tin chuyển khoản để nhập thủ công'}</p></div>
    </section>
    <p class="payment-note">Vui lòng thanh toán trước hạn thanh toán để tránh những phát sinh chi phí của việc chậm thanh toán.</p>
  `
}

export function invoiceEmailSubject(data: InvoiceDocumentData): string {
  return `Hoá đơn ${data.invoiceCode} – ${data.buildingName}`
}

export function renderInvoiceEmailHtml(
  data: InvoiceDocumentData,
  assets?: InvoiceDocumentAssets,
): string {
  const chargeRows = data.charges.map((charge, index) => `
    <tr>
      <td>${escapeHtml(chargeLineLabel(charge.chargeType, charge.label))}</td>
      <td class="number">${escapeHtml(meterValue(data, index, 'previous_reading_value'))}</td>
      <td class="number">${escapeHtml(meterValue(data, index, 'current_reading_value'))}</td>
      <td class="number">${formatViNumber(charge.quantity)}</td>
      <td class="number">${money.format(charge.unitPrice)}</td>
      <td class="number strong">${money.format(charge.amount)}</td>
    </tr>
  `).join('')
  const logo = assets?.logoImage
    ? `<img class="logo" src="cid:${escapeHtml(assets.logoImage.cid)}" alt="Logo ${escapeHtml(data.buildingName)}">`
    : `<span class="brand-name">${escapeHtml(data.buildingName)}</span>`

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(invoiceEmailSubject(data))}</title>
  <style>
    body{margin:0;background:#f4f6f8;color:#0f172a;font-family:Inter,Arial,sans-serif}
    main{max-width:720px;margin:0 auto;padding:28px 16px}.card{background:#fff;border:1px solid #dbe2ea;border-radius:12px;overflow:hidden}
    .header{display:grid;grid-template-columns:110px 1fr 132px;gap:14px;align-items:center;padding:24px 28px 18px;border-bottom:1px solid #e2e8f0}.logo{display:block;max-width:100px;max-height:54px;object-fit:contain}.brand-name{font-weight:700}.heading{text-align:center}.building{margin:0;color:#64748b;font-size:13px}.title{margin:4px 0;font-size:20px;line-height:1.2;text-transform:uppercase}.address{margin:0;color:#64748b;font-size:12px;font-style:italic}.identity{text-align:right}.code{display:inline-block;background:#0f172a;border-radius:4px;padding:6px 8px;color:#fff;font-size:12px;font-weight:700}.status{margin:7px 0 0;color:#475569;font-size:12px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;padding:14px 28px;border-bottom:1px solid #e2e8f0;font-size:13px}.meta dt{display:inline;color:#64748b}.meta dd{display:inline;margin:0;font-weight:600}
    .content{padding:20px 28px}.intro{line-height:1.55}.table-wrap{overflow-x:auto}table{width:100%;min-width:620px;border-collapse:collapse;font-size:12px}th,td{padding:9px 6px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}th{color:#64748b;font-size:10px;letter-spacing:.06em;text-transform:uppercase}.number{text-align:right;white-space:nowrap}.strong{font-weight:700}
    .totals{width:100%;max-width:320px;margin:18px 0 0 auto}.totals div{display:flex;justify-content:space-between;gap:20px;padding:5px 0}.totals .balance{border-top:2px solid #0f172a;margin-top:4px;padding-top:10px;font-size:17px;font-weight:700}.totals .muted{color:#64748b}.payment-title{margin:28px 0 10px;font-size:16px}.payment-wrap{display:grid;grid-template-columns:1fr 112px;gap:16px;align-items:start}.payment{margin:0}.payment div{display:grid;grid-template-columns:120px 1fr;gap:8px;padding:4px 0;font-size:13px}.payment dt{color:#64748b}.payment dd{margin:0;font-weight:600;overflow-wrap:anywhere}.qr-wrap{text-align:center;font-size:10px;color:#64748b}.qr{display:block;width:104px;height:104px;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px}.qr-fallback{display:flex;height:92px;align-items:center;justify-content:center;border:1px dashed #cbd5e1;border-radius:6px;padding:6px;text-align:center}.payment-note{margin:14px 0 0;padding:10px 12px;border:1px solid #fde68a;border-radius:6px;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.5}.payment-empty{color:#64748b;font-style:italic}
    @media(max-width:560px){main{padding:12px}.header{grid-template-columns:1fr;padding:20px;text-align:center}.logo{margin:auto}.identity{text-align:center}.meta{grid-template-columns:1fr;padding:14px 20px}.content{padding:18px 20px}.payment-wrap{grid-template-columns:1fr}.qr-wrap{display:flex;align-items:center;gap:10px;text-align:left}.payment div{grid-template-columns:106px 1fr}}
  </style>
</head>
<body><main><section class="card">
  <header class="header"><div>${logo}</div><div class="heading"><p class="building">${escapeHtml(data.buildingName)}</p><h1 class="title">Phiếu tính tiền nhà tháng ${escapeHtml(data.periodLabel)}</h1><p class="address">${escapeHtml(data.buildingAddress)}</p></div><div class="identity"><span class="code">${escapeHtml(data.invoiceCode)}</span><p class="status">Trạng thái: ${STATUS_LABELS[data.status]}</p></div></header>
  <dl class="meta"><div><dt>Phòng &amp; khách thuê: </dt><dd>Phòng ${escapeHtml(data.roomNumber)} · ${escapeHtml(data.tenantName)}</dd></div><div><dt>Phát hành &amp; hạn: </dt><dd>${formatDate(data.issuedAt)} — ${dueDateLabel(data.dueDate)}</dd></div></dl>
  <div class="content"><p class="intro">Ban quản lý gửi bạn phiếu tính tiền nhà. Bản PDF đầy đủ được đính kèm email này.</p><div class="table-wrap"><table><thead><tr><th>Nội dung</th><th class="number">Chỉ số cũ</th><th class="number">Chỉ số mới</th><th class="number">Số lượng</th><th class="number">Đơn giá</th><th class="number">Thành tiền</th></tr></thead><tbody>${chargeRows}</tbody></table></div>
  <div class="totals"><div class="muted"><span>Đã thu</span><span>${money.format(data.paidAmount)}</span></div><div class="muted"><span>Còn lại</span><span>${money.format(data.balanceAmount)}</span></div><div class="balance"><span>Tổng tiền</span><span>${money.format(data.totalAmount)}</span></div></div>
  <h2 class="payment-title">Thông tin chuyển khoản</h2>${paymentInstructions(data, assets)}${data.notes ? `<p class="intro"><strong>Ghi chú:</strong> ${escapeHtml(data.notes)}</p>` : ''}</div>
</section></main></body></html>`
}

export { escapeHtml }
