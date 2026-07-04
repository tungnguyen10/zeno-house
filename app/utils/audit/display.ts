import type { StatusVariant } from '~/utils/constants/statuses'
import type { AuditEvent } from '~/types/audit'
import { formatCurrency } from '~/utils/format/currency'

export interface AuditDiffRow {
  key: string
  label: string
  before: unknown
  after: unknown
  beforeText: string
  afterText: string
}

const MONEY_FIELDS = new Set([
  'monthlyRent',
  'deposit',
  'discountAmount',
  'surchargeAmount',
  'monthly_rent',
  'discount_amount',
  'surcharge_amount',
])

const DATE_FIELDS = new Set([
  'startDate',
  'endDate',
  'originalEndDate',
  'createdAt',
  'updatedAt',
  'start_date',
  'end_date',
  'original_end_date',
  'created_at',
  'updated_at',
])

const TECHNICAL_DIFF_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
])

const CONTRACT_FIELD_LABELS: Record<string, string> = {
  roomId: 'Phòng',
  tenantId: 'Khách thuê',
  buildingId: 'Tòa nhà',
  startDate: 'Ngày bắt đầu',
  endDate: 'Ngày kết thúc',
  monthlyRent: 'Giá thuê / tháng',
  deposit: 'Tiền cọc',
  paymentDay: 'Ngày thanh toán',
  occupantCount: 'Số người',
  discountAmount: 'Giảm giá',
  surchargeAmount: 'Phụ thu',
  status: 'Trạng thái',
  notes: 'Ghi chú',
  room_id: 'Phòng',
  tenant_id: 'Khách thuê',
  building_id: 'Tòa nhà',
  start_date: 'Ngày bắt đầu',
  end_date: 'Ngày kết thúc',
  monthly_rent: 'Giá thuê / tháng',
  payment_day: 'Ngày thanh toán',
  occupant_count: 'Số người',
  discount_amount: 'Giảm giá',
  surcharge_amount: 'Phụ thu',
}

const ACTION_SUFFIX_LABELS: Record<string, string> = {
  created: 'Tạo mới',
  updated: 'Cập nhật',
  removed: 'Xóa',
  archived: 'Lưu trữ',
  activated: 'Kích hoạt',
  terminated: 'Chấm dứt',
  expired: 'Hết hạn',
  renewed: 'Gia hạn',
  maintenance_set: 'Đặt bảo trì',
  role_changed: 'Đổi vai trò',
  assignment_added: 'Gán tòa nhà',
  assignment_removed: 'Gỡ tòa nhà',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang chạy',
  expired: 'Hết hạn',
  terminated: 'Đã chấm dứt',
  renewed: 'Đã gia hạn',
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function actionSuffix(action: string): string {
  return action.split('.').pop() ?? action
}

function formatDateOnly(input: string): string {
  const [year, month, day] = input.split('-')
  return `${day}/${month}/${year}`
}

function formatDateTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hour}:${minute}`
}

export function auditActionLabel(action: string): string {
  const suffix = actionSuffix(action)
  return ACTION_SUFFIX_LABELS[suffix] ?? suffix
}

export function auditActionVariant(action: string): StatusVariant {
  if (action.endsWith('.created') || action.endsWith('.activated') || action.endsWith('.assignment_added')) return 'success'
  if (action.endsWith('.updated') || action.endsWith('.renewed') || action.endsWith('.role_changed')) return 'accent'
  if (action.endsWith('.removed') || action.endsWith('.terminated') || action.endsWith('.assignment_removed')) return 'danger'
  if (action.endsWith('.archived') || action.endsWith('.maintenance_set') || action.endsWith('.expired')) return 'warning'
  return 'neutral'
}

export function auditActorLabel(event: AuditEvent): string {
  if (!event.actorId) return 'Hệ thống'
  return event.actorName ?? event.actorEmail ?? `#${event.actorId.slice(0, 8)}`
}

export function auditFieldLabel(key: string, entityType?: string): string {
  if (entityType === 'contract') return CONTRACT_FIELD_LABELS[key] ?? key
  return key
}

export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return formatCurrency(value)
  if (key === 'status' && typeof value === 'string') return STATUS_LABELS[value] ?? value
  if (typeof value === 'string') {
    if (DATE_FIELDS.has(key) && ISO_DATETIME_RE.test(value)) return formatDateTime(value)
    if (DATE_FIELDS.has(key) && ISO_DATE_RE.test(value)) return formatDateOnly(value)
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

export function auditDiffRows(before: unknown, after: unknown, entityType?: string): AuditDiffRow[] {
  if (!isPlainObject(before) && !isPlainObject(after)) return []
  const beforeRecord = isPlainObject(before) ? before : {}
  const afterRecord = isPlainObject(after) ? after : {}
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])
  const rows: AuditDiffRow[] = []
  for (const key of keys) {
    if (TECHNICAL_DIFF_FIELDS.has(key)) continue
    const beforeValue = beforeRecord[key]
    const afterValue = afterRecord[key]
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      rows.push({
        key,
        label: auditFieldLabel(key, entityType),
        before: beforeValue,
        after: afterValue,
        beforeText: formatAuditValue(key, beforeValue),
        afterText: formatAuditValue(key, afterValue),
      })
    }
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label))
}
