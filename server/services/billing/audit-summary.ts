function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatDate(value: unknown): string | null {
  const raw = stringValue(value)
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value: unknown): string | null {
  const amount = numberValue(value)
  if (amount === null) return null
  return `${Math.trunc(amount).toLocaleString('vi-VN')}đ`
}

export function formatAuditSummary(action: string, metadata: Record<string, unknown> = {}): string {
  const meta = asRecord(metadata)
  switch (action) {
    case 'period.opened':
      return 'Mở kỳ vận hành'
    case 'period.closed':
      return 'Chốt kỳ vận hành'
    case 'period.unissued': {
      const voided = numberValue(meta.voided_count) ?? 0
      const retained = numberValue(meta.retained_paid_count) ?? 0
      const reason = stringValue(meta.reason)
      const parts: string[] = [`Huỷ phát hành kỳ — huỷ ${voided} HĐ, giữ ${retained} HĐ đã thu`]
      if (reason) parts.push(`— ${reason}`)
      return parts.join(' ')
    }
    case 'period.status_changed': {
      const from = stringValue(meta.from) ?? stringValue(asRecord(meta.before).status) ?? stringValue(meta.previous_status) ?? '...'
      const to = stringValue(meta.to) ?? stringValue(asRecord(meta.after).status) ?? stringValue(meta.next_status) ?? '...'
      return `Đổi trạng thái: ${from} → ${to}`
    }
    case 'reading.saved': {
      const count = numberValue(meta.count) ?? numberValue(meta.saved_count) ?? 1
      return `Lưu ${count} chỉ số`
    }
    case 'utility.override_saved':
    case 'utility_override.saved': {
      const meterType = stringValue(meta.meter_type) ?? stringValue(meta.meterType) ?? 'điện/nước'
      const reason = stringValue(meta.reason)
      return `Ghi đè chỉ số ${meterType}${reason ? `, lý do ${reason}` : ''}`
    }
    case 'invoices.issued': {
      const count = numberValue(meta.issued_count) ?? numberValue(meta.issued) ?? 0
      const dueDate = formatDate(meta.due_date)
      return `Phát hành ${count} hoá đơn${dueDate ? `, hạn ${dueDate}` : ''}`
    }
    case 'invoice.voided': {
      const reason = stringValue(meta.reason)
      const total = formatCurrency(meta.total_amount)
      const parts: string[] = ['Huỷ hoá đơn']
      if (total) parts.push(total)
      if (reason) parts.push(`— ${reason}`)
      return parts.join(' ')
    }
    case 'invoice.reissued': {
      const oldTotal = formatCurrency(meta.old_total_amount)
      const newTotal = formatCurrency(meta.new_total_amount)
      const reason = stringValue(meta.void_reason)
      const parts: string[] = ['Phát hành lại hoá đơn']
      if (oldTotal && newTotal) parts.push(`${oldTotal} → ${newTotal}`)
      else if (newTotal) parts.push(newTotal)
      if (reason) parts.push(`— ${reason}`)
      return parts.join(' ')
    }
    case 'invoice.adjustment_created': {
      const label = stringValue(meta.label) ?? 'điều chỉnh'
      const amount = formatCurrency(meta.amount)
      return `Tạo điều chỉnh ${label}${amount ? ` ${amount}` : ''}`
    }
    case 'payment.recorded':
    case 'invoice.payment_recorded': {
      const amount = formatCurrency(meta.amount) ?? '0đ'
      const method = stringValue(meta.payment_method)
      return `Ghi thu ${amount}${method ? ` bằng ${method}` : ''}`
    }
    case 'payments.bulk_recorded': {
      const count = numberValue(meta.count) ?? numberValue(meta.payment_count) ?? 0
      const total = formatCurrency(meta.total_amount) ?? formatCurrency(meta.amount)
      return `Ghi thu hàng loạt ${count} khoản${total ? `, tổng ${total}` : ''}`
    }
    case 'invoice.issue_attempted': {
      const blocked = numberValue(meta.blocked_count) ?? 0
      return `Thử phát hành - ${blocked} hoá đơn bị chặn`
    }
    default:
      return `Hành động: ${action}`
  }
}
