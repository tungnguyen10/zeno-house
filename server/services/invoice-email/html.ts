import type { InvoiceDocumentData } from '../../types/invoice-email'

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

function paymentInstructions(data: InvoiceDocumentData): string {
  const profile = data.paymentProfile
  if (!profile) {
    return '<p>Vui lòng liên hệ ban quản lý để được hướng dẫn thanh toán.</p>'
  }
  return `
    <dl class="payment">
      <div><dt>Ngân hàng</dt><dd>${escapeHtml(profile.bankName)}</dd></div>
      <div><dt>Chủ tài khoản</dt><dd>${escapeHtml(profile.accountHolder)}</dd></div>
      <div><dt>Số tài khoản</dt><dd>${escapeHtml(profile.accountNumber)}</dd></div>
      <div><dt>Nội dung</dt><dd>${escapeHtml(profile.transferContent)}</dd></div>
    </dl>
  `
}

export function invoiceEmailSubject(data: InvoiceDocumentData): string {
  return `Hoá đơn ${data.invoiceCode} – ${data.buildingName}`
}

export function renderInvoiceEmailHtml(data: InvoiceDocumentData): string {
  const chargeRows = data.charges.map(charge => `
    <tr>
      <td>${escapeHtml(charge.label)}</td>
      <td class="number">${escapeHtml(String(charge.quantity))}</td>
      <td class="number">${money.format(charge.unitPrice)}</td>
      <td class="number">${money.format(charge.amount)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(invoiceEmailSubject(data))}</title>
  <style>
    body{margin:0;background:#f4f6f8;color:#17202a;font-family:Inter,Arial,sans-serif}
    main{max-width:680px;margin:0 auto;padding:32px 20px}
    .card{background:#fff;border:1px solid #dde3ea;border-radius:12px;padding:28px}
    h1{font-size:24px;margin:0 0 6px} h2{font-size:16px;margin:26px 0 10px}
    p{line-height:1.55} .muted{color:#667085}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{border-bottom:1px solid #e5e9ef;padding:10px 6px;text-align:left}
    .number{text-align:right;white-space:nowrap}
    .totals{margin-left:auto;max-width:360px}
    .totals div,.payment div{display:flex;justify-content:space-between;gap:20px;padding:5px 0}
    .totals strong{font-size:17px}.payment dt{color:#667085}.payment dd{margin:0;text-align:right}
    @media(max-width:520px){main{padding:12px}.card{padding:18px}.number{white-space:normal}}
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Hoá đơn ${escapeHtml(data.invoiceCode)}</h1>
      <p class="muted">${escapeHtml(data.buildingName)} · Phòng ${escapeHtml(data.roomNumber)} · Kỳ ${escapeHtml(data.periodLabel)}</p>
      <p>Xin chào ${escapeHtml(data.tenantName)},</p>
      <p>Ban quản lý gửi bạn thông tin hoá đơn. Bản PDF đầy đủ được đính kèm email này.</p>
      <h2>Chi tiết khoản thu</h2>
      <table>
        <thead><tr><th>Khoản thu</th><th class="number">SL</th><th class="number">Đơn giá</th><th class="number">Thành tiền</th></tr></thead>
        <tbody>${chargeRows}</tbody>
      </table>
      <div class="totals">
        <div><span>Tổng cộng</span><span>${money.format(data.totalAmount)}</span></div>
        <div><span>Đã thu</span><span>${money.format(data.paidAmount)}</span></div>
        <div><strong>Còn lại</strong><strong>${money.format(data.balanceAmount)}</strong></div>
        <div><span>Hạn thanh toán</span><span>${formatDate(data.dueDate)}</span></div>
      </div>
      <h2>Thông tin thanh toán</h2>
      ${paymentInstructions(data)}
      <p class="muted">Nếu bạn đã thanh toán, vui lòng bỏ qua thông báo này hoặc liên hệ ban quản lý để đối soát.</p>
    </section>
  </main>
</body>
</html>`
}

export { escapeHtml }
