import type { StatusVariant } from '~/utils/constants/statuses'
import type { AuditEvent } from '~/types/audit'
import { formatCurrency } from '~/utils/format/currency'
import type { AuditEntityType } from '~/utils/constants/audit'

export interface AuditEntityDisplayStyle {
  icon: string
  ring: string
  bg: string
  fg: string
}

interface AuditEntityCatalogEntry extends AuditEntityDisplayStyle {
  label: string
  group: 'Master data' | 'Phân quyền' | 'Hợp đồng' | 'Vận hành' | 'Tenant portal'
  snapshotKeys: string[]
}

export const AUDIT_ENTITY_CATALOG: Record<AuditEntityType, AuditEntityCatalogEntry> = {
  building: { label: 'Tòa nhà', group: 'Master data', snapshotKeys: ['name', 'code'], icon: 'IconBuilding', ring: 'ring-cyan/30', bg: 'bg-cyan/15', fg: 'text-cyan' },
  room: { label: 'Phòng', group: 'Master data', snapshotKeys: ['roomNumber', 'room_number', 'code'], icon: 'IconDoor', ring: 'ring-violet-500/30', bg: 'bg-violet-500/15', fg: 'text-violet-300' },
  tenant: { label: 'Khách thuê', group: 'Master data', snapshotKeys: ['fullName', 'full_name', 'name', 'phone'], icon: 'IconUsers', ring: 'ring-blue-500/30', bg: 'bg-blue-500/15', fg: 'text-blue-300' },
  contract: { label: 'Hợp đồng', group: 'Hợp đồng', snapshotKeys: ['contractCode', 'contract_code'], icon: 'IconDocumentText', ring: 'ring-amber-500/30', bg: 'bg-amber-500/15', fg: 'text-amber-300' },
  contract_renewal: { label: 'Gia hạn hợp đồng', group: 'Hợp đồng', snapshotKeys: ['contractCode', 'contract_code'], icon: 'IconRefresh', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/15', fg: 'text-emerald-300' },
  building_service: { label: 'Dịch vụ tòa nhà', group: 'Master data', snapshotKeys: ['name', 'serviceName', 'service_name'], icon: 'IconLayers', ring: 'ring-teal-500/30', bg: 'bg-teal-500/15', fg: 'text-teal-300' },
  contract_service: { label: 'Dịch vụ hợp đồng', group: 'Hợp đồng', snapshotKeys: ['name', 'serviceName', 'service_name'], icon: 'IconLayers', ring: 'ring-teal-500/30', bg: 'bg-teal-500/15', fg: 'text-teal-300' },
  meter_device: { label: 'Đồng hồ', group: 'Master data', snapshotKeys: ['serialNumber', 'serial_number', 'code'], icon: 'IconCpu', ring: 'ring-fuchsia-500/30', bg: 'bg-fuchsia-500/15', fg: 'text-fuchsia-300' },
  user: { label: 'Người dùng', group: 'Phân quyền', snapshotKeys: ['fullName', 'full_name', 'name', 'email'], icon: 'IconUsers', ring: 'ring-sky-500/30', bg: 'bg-sky-500/15', fg: 'text-sky-300' },
  building_expense: { label: 'Khoản chi tòa nhà', group: 'Vận hành', snapshotKeys: ['name', 'note', 'category'], icon: 'IconReceipt', ring: 'ring-orange-500/30', bg: 'bg-orange-500/15', fg: 'text-orange-300' },
  building_fixed_cost: { label: 'Chi phí cố định', group: 'Vận hành', snapshotKeys: ['name', 'note', 'category'], icon: 'IconReceipt', ring: 'ring-orange-500/30', bg: 'bg-orange-500/15', fg: 'text-orange-300' },
  recurring_expense: { label: 'Chi phí định kỳ', group: 'Vận hành', snapshotKeys: ['name', 'note', 'category'], icon: 'IconRefresh', ring: 'ring-orange-500/30', bg: 'bg-orange-500/15', fg: 'text-orange-300' },
  prepaid_expense: { label: 'Chi phí trả trước', group: 'Vận hành', snapshotKeys: ['name', 'note', 'category'], icon: 'IconCalendar', ring: 'ring-orange-500/30', bg: 'bg-orange-500/15', fg: 'text-orange-300' },
  support_request: { label: 'Yêu cầu hỗ trợ', group: 'Tenant portal', snapshotKeys: ['title'], icon: 'IconInfoCircle', ring: 'ring-blue-500/30', bg: 'bg-blue-500/15', fg: 'text-blue-300' },
  contract_occupant: { label: 'Người ở cùng', group: 'Hợp đồng', snapshotKeys: ['tenantName', 'tenant_name', 'fullName', 'full_name'], icon: 'IconUsers', ring: 'ring-amber-500/30', bg: 'bg-amber-500/15', fg: 'text-amber-300' },
  contract_payment: { label: 'Thanh toán hợp đồng', group: 'Hợp đồng', snapshotKeys: ['paymentType', 'payment_type', 'note'], icon: 'IconReceipt', ring: 'ring-amber-500/30', bg: 'bg-amber-500/15', fg: 'text-amber-300' },
  service_catalog_item: { label: 'Danh mục dịch vụ', group: 'Master data', snapshotKeys: ['name', 'code'], icon: 'IconLayers', ring: 'ring-teal-500/30', bg: 'bg-teal-500/15', fg: 'text-teal-300' },
  shared_expense: { label: 'Chi phí dùng chung', group: 'Vận hành', snapshotKeys: ['name', 'note', 'category'], icon: 'IconReceipt', ring: 'ring-orange-500/30', bg: 'bg-orange-500/15', fg: 'text-orange-300' },
  reserve_fund: { label: 'Quỹ dự phòng', group: 'Vận hành', snapshotKeys: ['name', 'note'], icon: 'IconShield', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/15', fg: 'text-emerald-300' },
  reserve_fund_rate: { label: 'Tỷ lệ quỹ dự phòng', group: 'Vận hành', snapshotKeys: ['reserveRatePercent', 'reserve_rate_percent'], icon: 'IconShield', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/15', fg: 'text-emerald-300' },
  operations_report_period: { label: 'Kỳ báo cáo vận hành', group: 'Vận hành', snapshotKeys: ['periodLabel', 'period_label'], icon: 'IconCalendar', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/15', fg: 'text-emerald-300' },
  tenant_document: { label: 'Tài liệu khách thuê', group: 'Tenant portal', snapshotKeys: ['name'], icon: 'IconDocumentText', ring: 'ring-blue-500/30', bg: 'bg-blue-500/15', fg: 'text-blue-300' },
}

const ENTITY_GROUPS = ['Master data', 'Phân quyền', 'Hợp đồng', 'Vận hành', 'Tenant portal'] as const

export const AUDIT_ENTITY_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả loại dữ liệu' },
  ...ENTITY_GROUPS.flatMap(group => [
    { value: `group:${group}`, label: group, disabled: true },
    ...Object.entries(AUDIT_ENTITY_CATALOG)
      .filter(([, entry]) => entry.group === group)
      .map(([value, entry]) => ({ value, label: entry.label })),
  ]),
]

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
  'amount',
  'defaultAmount',
  'default_amount',
  'monthlyAmount',
  'monthly_amount',
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
  assignment_updated: 'Cập nhật phân quyền',
  added: 'Thêm',
  moved_out: 'Ghi nhận rời phòng',
  attached: 'Gắn biên lai',
  deactivated: 'Ngừng sử dụng',
  allocated: 'Phân bổ',
  synced: 'Đồng bộ',
  recorded: 'Ghi nhận',
  dismissed: 'Bỏ qua',
  closed: 'Chốt báo cáo',
  auto_closed: 'Tự động chốt',
  reopened: 'Mở lại báo cáo',
  refreshed: 'Cập nhật quỹ',
  uploaded: 'Tải lên',
  profile_updated: 'Cập nhật hồ sơ',
  voided: 'Hủy',
  ended: 'Kết thúc',
  deleted: 'Xóa',
  enabled: 'Kích hoạt tài khoản',
  disabled: 'Vô hiệu hóa tài khoản',
  password_reset: 'Đặt lại mật khẩu',
  password_changed: 'Đổi mật khẩu',
  email_confirmed: 'Xác minh email',
  google_linked: 'Liên kết Google',
  provisioned: 'Cấp tài khoản',
  revoked: 'Thu hồi tài khoản',
  approved: 'Phê duyệt',
  rejected: 'Từ chối',
}

const ACTION_LABELS: Record<string, string> = {
  'building_expense.receipt_attached': 'Gắn biên lai',
  'building_expense.receipt_removed': 'Xóa biên lai',
  'operations_report_period.closed': 'Chốt báo cáo',
  'operations_report_period.auto_closed': 'Tự động chốt',
  'operations_report_period.reopened': 'Mở lại báo cáo',
  'reserve_fund.accrual_refreshed': 'Cập nhật quỹ',
  'tenant.profile_updated': 'Cập nhật hồ sơ',
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
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  const suffix = actionSuffix(action)
  return ACTION_SUFFIX_LABELS[suffix] ?? suffix
}

export function auditActionVariant(action: string): StatusVariant {
  if (/(\.created|\.activated|\.added|\.uploaded|\.recorded)$/.test(action)) return 'success'
  if (/(\.updated|\.renewed|\.role_changed|\.synced|\.attached|\.allocated|\.refreshed)$/.test(action)) return 'accent'
  if (/(\.removed|\.terminated|\.deleted|\.voided|\.deactivated)$/.test(action)) return 'danger'
  if (/(\.archived|\.maintenance_set|\.expired|\.moved_out|\.dismissed|\.reopened)$/.test(action)) return 'warning'
  return 'neutral'
}

export function auditEntityLabel(entityType: AuditEntityType | string): string {
  return AUDIT_ENTITY_CATALOG[entityType as AuditEntityType]?.label ?? entityType
}

export function auditEntityStyle(entityType: AuditEntityType | string): AuditEntityDisplayStyle {
  return AUDIT_ENTITY_CATALOG[entityType as AuditEntityType] ?? {
    icon: 'IconInfoCircle', ring: 'ring-dark-border', bg: 'bg-dark-surface', fg: 'text-muted',
  }
}

export function auditEntityDisplay(event: Pick<AuditEvent, 'entityType' | 'entityLabel' | 'entityId' | 'beforeData' | 'afterData'>): string {
  if (event.entityLabel?.trim()) return event.entityLabel.trim()
  const snapshot = event.afterData ?? event.beforeData
  if (isPlainObject(snapshot)) {
    const entry = AUDIT_ENTITY_CATALOG[event.entityType]
    for (const key of entry.snapshotKeys) {
      const value = snapshot[key]
      if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value)
    }
  }
  return event.entityId ? `#${event.entityId.slice(0, 8)}` : '—'
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
