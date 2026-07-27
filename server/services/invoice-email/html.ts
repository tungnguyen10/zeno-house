import { chargeLineLabel } from '~/utils/billing/charge-groups'
import { formatMeterReading, formatViNumber } from '~/utils/billing/meter-display'
import type { InvoiceDocumentAssets, InvoiceDocumentData } from '../../types/invoice-email'
import { imageDataUri, invoiceStatusSwatch } from './theme'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

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
    ? `<img class="qr" src="${imageDataUri(assets.qrImage)}" alt="Mã QR chuyển khoản ngân hàng">`
    : '<p class="qr-fallback">Nếu email không hiển thị mã QR, vui lòng dùng đúng thông tin chuyển khoản bên cạnh.</p>'
  return `
    <p class="payment-kicker"><span class="kicker-rule"></span>Thông tin chuyển khoản</p>
    <table class="payment-wrap" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td class="payment-info">
          <dl class="payment">
            <div><dt>Người thụ hưởng</dt><dd>${escapeHtml(profile.accountHolder)}</dd></div>
            <div><dt>Số tài khoản</dt><dd class="account">${escapeHtml(profile.accountNumber)}</dd></div>
            <div><dt>Ngân hàng</dt><dd>${escapeHtml(profile.bankName)}</dd></div>
            <div><dt>Nội dung</dt><dd>${escapeHtml(profile.transferContent)}</dd></div>
          </dl>
        </td>
        <td class="payment-qr-cell">
          <div class="qr-wrap">${qr}<p class="qr-caption">${assets?.qrImage ? 'Quét mã để chuyển khoản' : 'Dùng thông tin chuyển khoản để nhập thủ công'}</p></div>
        </td>
      </tr>
    </table>
    <p class="payment-note"><span class="note-badge">!</span><span>Vui lòng thanh toán trước hạn thanh toán để tránh những phát sinh chi phí của việc chậm thanh toán.</span></p>
  `
}

export function invoiceEmailSubject(data: InvoiceDocumentData): string {
  return `Hoá đơn ${data.invoiceCode} – ${data.buildingName}`
}

export function renderInvoiceEmailHtml(
  data: InvoiceDocumentData,
  assets?: InvoiceDocumentAssets,
): string {
  const status = invoiceStatusSwatch(data.status)
  const balancePositive = data.balanceAmount > 0
  const chargeRows = data.charges.map((charge, index) => `
    <tr>
      <td class="line-label">${escapeHtml(chargeLineLabel(charge.chargeType, charge.label))}</td>
      <td class="number meter">${escapeHtml(meterValue(data, index, 'previous_reading_value'))}</td>
      <td class="number meter">${escapeHtml(meterValue(data, index, 'current_reading_value'))}</td>
      <td class="number">${formatViNumber(charge.quantity)}</td>
      <td class="number">${money.format(charge.unitPrice)}</td>
      <td class="number strong">${money.format(charge.amount)}</td>
    </tr>
  `).join('')
  const logo = assets?.logoImage
    ? `<img class="logo" src="${imageDataUri(assets.logoImage)}" alt="Logo ${escapeHtml(data.buildingName)}">`
    : `<span class="brand-name">${escapeHtml(data.buildingName)}</span>`

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(invoiceEmailSubject(data))}</title>
  <style>
    body{margin:0;background:#f4f6f8;color:#0f172a;font-family:Inter,Arial,sans-serif}
    main{max-width:720px;margin:0 auto;padding:28px 16px}.card{background:#fff;border:1px solid #dbe2ea;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.06)}
    .header{display:grid;grid-template-columns:110px 1fr 132px;gap:14px;align-items:center;padding:24px 28px 18px;border-bottom:1px solid #e2e8f0}.logo{display:block;max-width:100px;max-height:54px;object-fit:contain}.brand-name{font-weight:700;font-size:15px}.heading{text-align:center}.building{margin:0;color:#64748b;font-size:13px;font-weight:500}.title{margin:4px 0;font-size:20px;line-height:1.15;text-transform:uppercase;letter-spacing:-.01em}.address{margin:0;color:#64748b;font-size:12px;font-style:italic}.identity{text-align:right}.code{display:inline-block;background:#0f172a;border-radius:5px;padding:6px 9px;color:#fff;font-size:12px;font-weight:600;letter-spacing:.02em}.status{display:inline-block;margin:8px 0 0;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${status.background};color:${status.foreground};border:1px solid ${status.border}}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;padding:14px 28px;border-bottom:1px solid #e2e8f0;font-size:13px}.meta div{min-width:0}.meta dt{display:inline;color:#64748b}.meta dd{display:inline;margin:0;font-weight:600}
    .content{padding:20px 28px 26px}.intro{margin:0 0 14px;line-height:1.55;color:#334155;font-size:13px}.table-wrap{overflow-x:auto}table.charges{width:100%;min-width:620px;border-collapse:collapse;font-size:12px}table.charges th,table.charges td{padding:9px 6px;border-bottom:1px solid #eef2f6;text-align:left;vertical-align:top}table.charges thead th{border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10px;letter-spacing:.07em;text-transform:uppercase;font-weight:500}table.charges tbody tr:last-child td{border-bottom:0}.line-label{font-weight:600;color:#0f172a}.number{text-align:right;white-space:nowrap;color:#334155;font-variant-numeric:tabular-nums}.meter{color:#94a3b8}.strong{font-weight:700;color:#0f172a}
    .totals{width:100%;max-width:300px;margin:16px 0 0 auto;border-collapse:collapse}.totals td{padding:5px 0;font-size:13px}.totals .t-label{color:#64748b}.totals .t-value{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}.totals .balance .t-value{color:${balancePositive ? '#e11d48' : '#059669'}}.totals .grand td{border-top:2px solid #0f172a;padding-top:11px}.totals .grand .t-label{font-weight:600;color:#0f172a}.totals .grand .t-value{font-size:19px;font-weight:700;color:#0f172a}
    .payment-kicker{display:flex;align-items:center;gap:8px;margin:26px 0 12px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#0f172a}.kicker-rule{display:inline-block;width:22px;height:2px;background:#0f172a}
    .payment-wrap{width:100%;border-collapse:collapse}.payment-info{vertical-align:top}.payment-qr-cell{width:132px;vertical-align:top;text-align:center}.payment{margin:0}.payment div{display:grid;grid-template-columns:118px 1fr;gap:8px;padding:4px 0;font-size:13px}.payment dt{color:#64748b}.payment dd{margin:0;font-weight:600;overflow-wrap:anywhere}.payment dd.account{letter-spacing:.02em;font-variant-numeric:tabular-nums}
    .qr-wrap{text-align:center}.qr{display:block;width:112px;height:112px;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:4px;margin:0 auto}.qr-fallback{display:flex;height:104px;align-items:center;justify-content:center;border:1px dashed #cbd5e1;border-radius:8px;padding:6px;text-align:center;font-size:11px;color:#64748b}.qr-caption{margin:7px 0 0;font-size:10px;font-style:italic;color:#64748b}
    .payment-note{display:flex;align-items:flex-start;gap:8px;margin:16px 0 0;padding:10px 12px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.5}.note-badge{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-top:1px;border-radius:999px;background:#f59e0b;color:#fff;font-size:10px;font-weight:700;line-height:1}.payment-empty{color:#64748b;font-style:italic}.notes{margin:14px 0 0;font-size:12px;color:#475569;line-height:1.5}
    @media(max-width:560px){main{padding:12px}.header{grid-template-columns:1fr;padding:20px;text-align:center}.logo{margin:auto}.identity{text-align:center}.meta{grid-template-columns:1fr;padding:14px 20px}.content{padding:18px 20px}.payment-qr-cell{width:120px}.payment div{grid-template-columns:104px 1fr}}
  </style>
</head>
<body><main><section class="card">
  <header class="header"><div>${logo}</div><div class="heading"><p class="building">${escapeHtml(data.buildingName)}</p><h1 class="title">Phiếu tính tiền nhà tháng ${escapeHtml(data.periodLabel)}</h1><p class="address">${escapeHtml(data.buildingAddress)}</p></div><div class="identity"><span class="code">${escapeHtml(data.invoiceCode)}</span><br><span class="status">${escapeHtml(status.label)}</span></div></header>
  <dl class="meta"><div><dt>Phòng &amp; khách thuê: </dt><dd>Phòng ${escapeHtml(data.roomNumber)} · ${escapeHtml(data.tenantName)}</dd></div><div><dt>Phát hành &amp; hạn: </dt><dd>${formatDate(data.issuedAt)} — ${dueDateLabel(data.dueDate)}</dd></div></dl>
  <div class="content"><p class="intro">Ban quản lý gửi bạn phiếu tính tiền nhà. Bản PDF đầy đủ được đính kèm email này.</p><div class="table-wrap"><table class="charges"><thead><tr><th>Nội dung</th><th class="number">Chỉ số cũ</th><th class="number">Chỉ số mới</th><th class="number">Số lượng</th><th class="number">Đơn giá</th><th class="number">Thành tiền</th></tr></thead><tbody>${chargeRows}</tbody></table></div>
  <table class="totals" role="presentation" cellpadding="0" cellspacing="0"><tr><td class="t-label">Đã thu</td><td class="t-value">${money.format(data.paidAmount)}</td></tr><tr class="balance"><td class="t-label">Còn lại</td><td class="t-value">${money.format(data.balanceAmount)}</td></tr><tr class="grand"><td class="t-label">Tổng tiền</td><td class="t-value">${money.format(data.totalAmount)}</td></tr></table>
  ${paymentInstructions(data, assets)}${data.notes ? `<p class="notes"><strong>Ghi chú:</strong> ${escapeHtml(data.notes)}</p>` : ''}</div>
</section></main></body></html>`
}

export { escapeHtml }
