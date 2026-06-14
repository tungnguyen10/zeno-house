<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import clsx from 'clsx'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type {
  BillingDraftGridResponse,
  BillingDraftGridRow,
  BillingDraftGridUtilityCell,
  BillingDraftLine,
  BillingPeriod,
} from '~/types/billing'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'
import { parsePastedColumn } from '~/utils/billing/clipboard'

type GridFilter = 'needs_action' | 'all' | 'vacant' | 'errors' | 'ready'
type MeterType = 'electricity' | 'water'

const props = defineProps<{
  response: BillingDraftGridResponse | null
  loading: boolean
  period: BillingPeriod | null
  onSaveReadings: (readings: MeterReadingBulkInput['readings']) => Promise<void>
  onSaveOverride: (input: UtilityUsageOverrideInput) => Promise<void>
}>()

defineEmits<{
  (e: 'refresh'): void
  (e: 'intent:adjustment', payload: { invoiceId: string; amount: number; label: string }): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

// ---------------------------------------------------------------------------
// Period editability
// ---------------------------------------------------------------------------

const periodEditable = computed(() => {
  const status = props.period?.status
  return status !== 'issued' && status !== 'collecting' && status !== 'closed'
})

// ---------------------------------------------------------------------------
// Toolbar state
// ---------------------------------------------------------------------------

const filter = ref<GridFilter>('needs_action')
const batchReadingDate = ref<string>('')
const expandedRowKeys = ref<Set<string>>(new Set())
const localReadings = ref<Record<string, string>>({}) // key = `${roomId}::${meterType}`
const isSaving = ref(false)

// Per-row auto-save state ----------------------------------------------------
type RowSaveState = 'idle' | 'saving' | 'saved' | 'error'
const rowSaveState = ref<Record<string, RowSaveState>>({})
const rowSaveError = ref<Record<string, string>>({})
const pasteHighlight = ref<Set<string>>(new Set())
const rowSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const rowSavedFlash: Record<string, ReturnType<typeof setTimeout>> = {}
const AUTO_SAVE_DEBOUNCE_MS = 800
const PASTE_HIGHLIGHT_MS = 1500

onBeforeUnmount(() => {
  for (const t of Object.values(rowSaveTimers)) clearTimeout(t)
  for (const t of Object.values(rowSavedFlash)) clearTimeout(t)
})

watch(
  () => props.response?.batchReadingDate,
  (next) => {
    if (next && !batchReadingDate.value) batchReadingDate.value = next
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

const filteredRows = computed<BillingDraftGridRow[]>(() => {
  const rows = props.response?.rows ?? []
  switch (filter.value) {
    case 'all':
      return rows
    case 'vacant':
      return rows.filter(r => r.rowType === 'vacant_baseline')
    case 'errors':
      return rows.filter(r => r.blockers.length > 0)
    case 'ready':
      return rows.filter(r => r.status === 'ready')
    case 'needs_action':
    default:
      return rows.filter((r) => {
        if (r.rowType === 'vacant_baseline') return false
        if (r.status === 'paid' || r.status === 'partial' || r.status === 'issued') return false
        return true
      })
  }
})

const filterTabs: Array<{ key: GridFilter; label: string }> = [
  { key: 'needs_action', label: 'Cần xử lý' },
  { key: 'all', label: 'Tất cả' },
  { key: 'vacant', label: 'Phòng trống' },
  { key: 'errors', label: 'Có lỗi' },
  { key: 'ready', label: 'Đã sẵn sàng' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellKey(row: BillingDraftGridRow, type: MeterType): string {
  return `${row.roomId}::${type}`
}

function readingDraftValue(row: BillingDraftGridRow, type: MeterType): string {
  const local = localReadings.value[cellKey(row, type)]
  if (local !== undefined) return local
  const cell = type === 'electricity' ? row.electricity : row.water
  if (!cell) return ''
  return cell.currentValue !== null ? String(cell.currentValue) : ''
}

function setReadingDraftValue(row: BillingDraftGridRow, type: MeterType, value: string) {
  localReadings.value[cellKey(row, type)] = value
  scheduleRowSave(row)
}

function scheduleRowSave(row: BillingDraftGridRow) {
  if (!periodEditable.value || !row.editable) return
  const existing = rowSaveTimers[row.roomId]
  if (existing) clearTimeout(existing)
  // Reset transient saved/error markers as the user is editing again.
  if (rowSaveState.value[row.roomId] === 'saved' || rowSaveState.value[row.roomId] === 'error') {
    rowSaveState.value[row.roomId] = 'idle'
    Reflect.deleteProperty(rowSaveError.value, row.roomId)
  }
  rowSaveTimers[row.roomId] = setTimeout(() => {
    void saveRow(row)
  }, AUTO_SAVE_DEBOUNCE_MS)
}

function buildRowReadingsPayload(row: BillingDraftGridRow): MeterReadingBulkInput['readings'] {
  if (!props.period) return []
  if (!batchReadingDate.value) return []
  const out: MeterReadingBulkInput['readings'] = []
  for (const type of ['electricity', 'water'] as MeterType[]) {
    if (!isCellDirty(row, type)) continue
    const cell = type === 'electricity' ? row.electricity : row.water
    if (!cell) continue
    const localValue = localReadings.value[cellKey(row, type)] ?? ''
    const trimmed = localValue.trim()
    if (trimmed === '') continue
    const numeric = Number(trimmed)
    if (!Number.isFinite(numeric)) continue
    out.push({
      room_id: row.roomId,
      meter_type: type,
      period_year: props.period.periodYear,
      period_month: props.period.periodMonth,
      reading_type: 'monthly',
      reading_date: cell.readingDate ?? batchReadingDate.value,
      reading_value: numeric,
    })
  }
  return out
}

async function saveRow(row: BillingDraftGridRow) {
  Reflect.deleteProperty(rowSaveTimers, row.roomId)
  const payload = buildRowReadingsPayload(row)
  if (payload.length === 0) {
    rowSaveState.value[row.roomId] = 'idle'
    return
  }
  rowSaveState.value[row.roomId] = 'saving'
  Reflect.deleteProperty(rowSaveError.value, row.roomId)
  try {
    await props.onSaveReadings(payload)
    // Clear local drafts for the cells we just persisted; the merged grid
    // refresh will provide fresh stored values.
    for (const item of payload) {
      Reflect.deleteProperty(localReadings.value, `${item.room_id}::${item.meter_type}`)
    }
    rowSaveState.value[row.roomId] = 'saved'
    if (rowSavedFlash[row.roomId]) clearTimeout(rowSavedFlash[row.roomId])
    rowSavedFlash[row.roomId] = setTimeout(() => {
      if (rowSaveState.value[row.roomId] === 'saved') {
        rowSaveState.value[row.roomId] = 'idle'
      }
    }, PASTE_HIGHLIGHT_MS)
  }
  catch (err) {
    rowSaveState.value[row.roomId] = 'error'
    rowSaveError.value[row.roomId] = err instanceof Error ? err.message : 'Lưu thất bại'
  }
}

function rowSaveStateOf(row: BillingDraftGridRow): RowSaveState {
  return rowSaveState.value[row.roomId] ?? 'idle'
}

function isPasteHighlighted(row: BillingDraftGridRow, type: MeterType): boolean {
  return pasteHighlight.value.has(cellKey(row, type))
}

function editableRowsFor(type: MeterType): BillingDraftGridRow[] {
  return filteredRows.value.filter((row) => {
    const cell = type === 'electricity' ? row.electricity : row.water
    return row.editable && !!cell?.editable
  })
}

function editableCellOrder(): Array<{ row: BillingDraftGridRow; type: MeterType }> {
  const cells: Array<{ row: BillingDraftGridRow; type: MeterType }> = []
  for (const row of filteredRows.value) {
    if (!row.editable) continue
    if (row.electricity?.editable) cells.push({ row, type: 'electricity' })
    if (row.water?.editable) cells.push({ row, type: 'water' })
  }
  return cells
}

function focusReadingCell(row: BillingDraftGridRow, type: MeterType) {
  nextTick(() => {
    const selector = `[data-reading-cell="${row.roomId}::${type}"] input`
    const input = document.querySelector<HTMLInputElement>(selector)
    input?.focus()
    input?.select()
  })
}

function handleReadingTab(event: KeyboardEvent, row: BillingDraftGridRow, type: MeterType) {
  event.preventDefault()
  const direction = event.shiftKey ? -1 : 1
  const cells = editableCellOrder()
  const currentIndex = cells.findIndex(c => c.row.key === row.key && c.type === type)
  const next = cells[currentIndex + direction]
  if (next) focusReadingCell(next.row, next.type)
}

function handleReadingKeydown(event: KeyboardEvent, row: BillingDraftGridRow, type: MeterType) {
  if (event.key === 'Tab') {
    handleReadingTab(event, row, type)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const direction = event.shiftKey ? -1 : 1
    const rows = editableRowsFor(type)
    const currentIndex = rows.findIndex(r => r.key === row.key)
    const nextRow = rows[currentIndex + direction]
    if (nextRow) focusReadingCell(nextRow, type)
  }
}

function handleReadingPaste(event: ClipboardEvent, row: BillingDraftGridRow, type: MeterType) {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  const values = parsePastedColumn(text)
  if (values.length <= 1) return
  event.preventDefault()
  const rows = editableRowsFor(type)
  const startIndex = rows.findIndex(r => r.key === row.key)
  if (startIndex < 0) return
  const affected: Array<{ row: BillingDraftGridRow; key: string }> = []
  values.forEach((value, offset) => {
    const targetRow = rows[startIndex + offset]
    if (!targetRow) return
    const key = cellKey(targetRow, type)
    setReadingDraftValue(targetRow, type, value)
    affected.push({ row: targetRow, key })
  })
  // Briefly highlight pasted cells so users see what changed.
  for (const { key } of affected) pasteHighlight.value.add(key)
  pasteHighlight.value = new Set(pasteHighlight.value)
  setTimeout(() => {
    for (const { key } of affected) pasteHighlight.value.delete(key)
    pasteHighlight.value = new Set(pasteHighlight.value)
  }, PASTE_HIGHLIGHT_MS)
}

function isCellDirty(row: BillingDraftGridRow, type: MeterType): boolean {
  const key = cellKey(row, type)
  if (!(key in localReadings.value)) return false
  const local = localReadings.value[key]
  const cell = type === 'electricity' ? row.electricity : row.water
  if (!cell) return local !== ''
  const stored = cell.currentValue !== null ? String(cell.currentValue) : ''
  return (local ?? '') !== stored
}

function dirtyCount(): number {
  let count = 0
  for (const row of props.response?.rows ?? []) {
    if (isCellDirty(row, 'electricity')) count += 1
    if (isCellDirty(row, 'water')) count += 1
  }
  return count
}

const dirtyCountValue = computed(() => dirtyCount())

function isExpanded(row: BillingDraftGridRow): boolean {
  return expandedRowKeys.value.has(row.key)
}

function toggleExpand(row: BillingDraftGridRow) {
  if (expandedRowKeys.value.has(row.key)) expandedRowKeys.value.delete(row.key)
  else expandedRowKeys.value.add(row.key)
  // trigger reactivity for Set
  expandedRowKeys.value = new Set(expandedRowKeys.value)
}

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

function statusBadgeFor(row: BillingDraftGridRow): { status: string; context: 'period' | 'invoice' | 'correction' } {
  switch (row.status) {
    case 'paid':
      return { status: 'paid', context: 'invoice' }
    case 'partial':
      return { status: 'partial', context: 'invoice' }
    case 'issued':
      return { status: 'issued', context: 'invoice' }
    case 'missing_reading':
      return { status: 'missing_reading', context: 'correction' }
    case 'blocked':
      return { status: 'blocked', context: 'correction' }
    case 'warning':
      return { status: 'review', context: 'period' }
    case 'baseline':
      return { status: 'baseline', context: 'correction' }
    case 'ready':
    default:
      return { status: 'ready', context: 'correction' }
  }
}

// ---------------------------------------------------------------------------
// Cell formatting
// ---------------------------------------------------------------------------

function formatUsage(cell: BillingDraftGridUtilityCell | null): string {
  if (!cell) return '—'
  if (cell.source === 'fixed') return 'Cố định'
  if (cell.source === 'per_person') return cell.usage !== null ? `${cell.usage} người` : '—'
  if (cell.source === 'not_applicable') return '—'
  if (cell.usage === null) return '—'
  const unit = cell.meterType === 'electricity' ? 'kWh' : 'm³'
  return `${cell.usage} ${unit}`
}

function formatCellAmount(cell: BillingDraftGridUtilityCell | null): string {
  if (!cell || cell.amount === null) return '—'
  return formatCurrency(cell.amount)
}

function previousReadingHint(cell: BillingDraftGridUtilityCell | null): string {
  if (!cell || cell.previousValue === null) return '—'
  return `Cũ ${cell.previousValue}`
}

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------

async function saveAll() {
  if (!periodEditable.value) return
  if (!props.period) return
  if (!batchReadingDate.value) return
  const payload: MeterReadingBulkInput['readings'] = []
  for (const row of props.response?.rows ?? []) {
    if (!row.editable) continue
    for (const type of ['electricity', 'water'] as MeterType[]) {
      if (!isCellDirty(row, type)) continue
      const cell = type === 'electricity' ? row.electricity : row.water
      if (!cell) continue
      const localValue = localReadings.value[cellKey(row, type)] ?? ''
      const trimmed = localValue.trim()
      if (trimmed === '') continue
      const numeric = Number(trimmed)
      if (!Number.isFinite(numeric)) continue
      payload.push({
        room_id: row.roomId,
        meter_type: type,
        period_year: props.period.periodYear,
        period_month: props.period.periodMonth,
        reading_type: 'monthly',
        reading_date: cell.readingDate ?? batchReadingDate.value,
        reading_value: numeric,
      })
    }
  }
  if (payload.length === 0) return
  isSaving.value = true
  try {
    await props.onSaveReadings(payload)
    localReadings.value = {}
  } finally {
    isSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Override modal
// ---------------------------------------------------------------------------

type OverrideReason = 'normal' | 'replacement' | 'reset' | 'correction' | 'manual_adjustment'

interface MeterFormState {
  enabled: boolean
  previousReadingId: string | null
  previousValue: string
  currentReadingId: string | null
  currentValue: string
  oldMeterFinal: string
  newMeterStart: string
  billableUsage: string
  reason: OverrideReason
  note: string
}

function emptyMeterForm(): MeterFormState {
  return {
    enabled: false,
    previousReadingId: null,
    previousValue: '',
    currentReadingId: null,
    currentValue: '',
    oldMeterFinal: '',
    newMeterStart: '',
    billableUsage: '',
    reason: 'replacement',
    note: '',
  }
}

const overrideOpen = ref(false)
const overrideRow = ref<BillingDraftGridRow | null>(null)
const overrideElectricity = ref<MeterFormState>(emptyMeterForm())
const overrideWater = ref<MeterFormState>(emptyMeterForm())
const overrideError = ref<string | null>(null)
const overrideSaving = ref(false)

function toNum(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

interface BillableResult { value: number | null; missing: string[] }

function computeBillable(form: MeterFormState): BillableResult {
  const prev = toNum(form.previousValue)
  const curr = toNum(form.currentValue)
  const oldFinal = toNum(form.oldMeterFinal)
  const newStart = toNum(form.newMeterStart)
  const reason = form.reason
  const missing: string[] = []

  if (reason === 'manual_adjustment') return { value: null, missing: [] }

  if (prev === null) missing.push('Chỉ số kỳ trước')
  if (curr === null) missing.push('Chỉ số kỳ này')

  if (reason === 'replacement') {
    if (oldFinal === null) missing.push('Số cuối đồng hồ cũ')
    if (newStart === null) missing.push('Số đầu đồng hồ mới')
    if (missing.length > 0) return { value: null, missing }
    return { value: (oldFinal! - prev!) + (curr! - newStart!), missing: [] }
  }
  if (reason === 'reset') {
    if (oldFinal === null) missing.push('Số cuối đồng hồ cũ (trước khi nhảy về 0)')
    if (missing.length > 0) return { value: null, missing }
    return { value: (oldFinal! - prev!) + curr!, missing: [] }
  }
  if (missing.length > 0) return { value: null, missing }
  return { value: curr! - prev!, missing: [] }
}

const electricityBillable = computed(() => computeBillable(overrideElectricity.value))
const waterBillable = computed(() => computeBillable(overrideWater.value))

watch(electricityBillable, (next) => {
  const f = overrideElectricity.value
  if (f.reason === 'manual_adjustment') return
  f.billableUsage = next.value !== null ? String(next.value) : ''
})

watch(waterBillable, (next) => {
  const f = overrideWater.value
  if (f.reason === 'manual_adjustment') return
  f.billableUsage = next.value !== null ? String(next.value) : ''
})

watch(() => overrideElectricity.value.reason, (r, prev) => {
  const f = overrideElectricity.value
  if (r !== 'replacement' && r !== 'reset') f.oldMeterFinal = ''
  if (r !== 'replacement') f.newMeterStart = ''
  if (r === 'manual_adjustment') return
  if (prev === 'manual_adjustment') {
    const next = electricityBillable.value
    f.billableUsage = next.value !== null ? String(next.value) : ''
  }
})

watch(() => overrideWater.value.reason, (r, prev) => {
  const f = overrideWater.value
  if (r !== 'replacement' && r !== 'reset') f.oldMeterFinal = ''
  if (r !== 'replacement') f.newMeterStart = ''
  if (r === 'manual_adjustment') return
  if (prev === 'manual_adjustment') {
    const next = waterBillable.value
    f.billableUsage = next.value !== null ? String(next.value) : ''
  }
})

function populateMeterForm(row: BillingDraftGridRow, type: MeterType): MeterFormState {
  const cell = type === 'electricity' ? row.electricity : row.water
  const form = emptyMeterForm()
  if (!cell) return form
  form.previousReadingId = cell.previousReadingId
  form.previousValue = cell.previousValue !== null ? String(cell.previousValue) : ''
  form.currentReadingId = cell.currentReadingId
  form.currentValue = cell.currentValue !== null ? String(cell.currentValue) : ''
  form.billableUsage = cell.usage !== null ? String(Math.max(cell.usage, 0)) : ''
  return form
}

const electricityRequired = computed(() => !!overrideRow.value?.electricity?.required)
const waterRequired = computed(() => !!overrideRow.value?.water?.required)

function openOverrideModal(row: BillingDraftGridRow, type?: MeterType) {
  if (!row.editable) return
  const hasElec = !!row.electricity?.required
  const hasWater = !!row.water?.required
  if (!hasElec && !hasWater) return
  overrideRow.value = row
  if (hasElec) {
    overrideElectricity.value = populateMeterForm(row, 'electricity')
    overrideElectricity.value.enabled = type ? type === 'electricity' : !hasWater || true
  } else {
    overrideElectricity.value = emptyMeterForm()
  }
  if (hasWater) {
    overrideWater.value = populateMeterForm(row, 'water')
    overrideWater.value.enabled = type ? type === 'water' : !hasElec || true
  } else {
    overrideWater.value = emptyMeterForm()
  }
  // If a specific type was requested, leave only that one enabled by default;
  // otherwise enable both when both are required so the user can adjust together.
  if (type === 'electricity') overrideWater.value.enabled = false
  if (type === 'water') overrideElectricity.value.enabled = false
  if (!type) {
    if (hasElec) overrideElectricity.value.enabled = true
    if (hasWater) overrideWater.value.enabled = true
  }
  overrideError.value = null
  overrideOpen.value = true
}

function closeOverrideModal() {
  overrideOpen.value = false
  overrideRow.value = null
}

function validateForm(form: MeterFormState, label: string): string | null {
  const billable = Number(form.billableUsage)
  const prev = Number(form.previousValue)
  const curr = Number(form.currentValue)
  if (!Number.isFinite(billable) || billable < 0) return `${label}: tiêu thụ tính tiền phải >= 0`
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return `${label}: giá trị chỉ số không hợp lệ`
  if (form.reason !== 'normal' && form.note.trim().length === 0) return `${label}: cần ghi rõ lý do điều chỉnh`
  return null
}

function buildOverridePayload(form: MeterFormState, type: MeterType): UtilityUsageOverrideInput {
  const oldFinal = form.oldMeterFinal.trim()
  const newStart = form.newMeterStart.trim()
  return {
    room_id: overrideRow.value!.roomId,
    meter_type: type,
    previous_reading_id: form.previousReadingId,
    previous_reading_value: Number(form.previousValue),
    current_reading_id: form.currentReadingId,
    current_reading_value: Number(form.currentValue),
    old_meter_final_value: oldFinal === '' ? null : Number(oldFinal),
    new_meter_start_value: newStart === '' ? null : Number(newStart),
    billable_usage: Number(form.billableUsage),
    reason: form.reason,
    note: form.note.trim() === '' ? null : form.note.trim(),
  }
}

async function submitOverride() {
  if (!overrideRow.value) return
  const elec = overrideElectricity.value
  const water = overrideWater.value
  const tasks: Array<{ payload: UtilityUsageOverrideInput }> = []

  if (electricityRequired.value && elec.enabled) {
    const err = validateForm(elec, 'Điện')
    if (err) { overrideError.value = err; return }
    tasks.push({ payload: buildOverridePayload(elec, 'electricity') })
  }
  if (waterRequired.value && water.enabled) {
    const err = validateForm(water, 'Nước')
    if (err) { overrideError.value = err; return }
    tasks.push({ payload: buildOverridePayload(water, 'water') })
  }
  if (tasks.length === 0) {
    overrideError.value = 'Hãy bật ít nhất một loại đồng hồ để điều chỉnh'
    return
  }

  overrideError.value = null
  overrideSaving.value = true
  try {
    for (const task of tasks) {
      await props.onSaveOverride(task.payload)
    }
    closeOverrideModal()
  } catch (e) {
    overrideError.value = e instanceof Error ? e.message : 'Lưu thất bại'
  } finally {
    overrideSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Table columns (desktop)
// ---------------------------------------------------------------------------

const columns: UiTableColumn<BillingDraftGridRow>[] = [
  { key: 'order', label: 'TT', width: 'w-12' },
  { key: 'expand', label: '', width: 'w-10' },
  { key: 'room', label: 'Phòng' },
  { key: 'tenant', label: 'Khách thuê' },
  { key: 'electricity_input', label: 'Số điện mới', numeric: true, width: 'w-32' },
  { key: 'water_input', label: 'Số nước mới', numeric: true, width: 'w-32' },
  { key: 'electricity_amount', label: 'Tiền điện', numeric: true, width: 'w-36' },
  { key: 'water_amount', label: 'Tiền nước', numeric: true, width: 'w-36' },
  { key: 'rent_service', label: 'Phòng/Dịch vụ', numeric: true, width: 'w-36' },
  { key: 'draft_total', label: 'Tổng nháp', numeric: true, width: 'w-36' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'actions', label: '', action: true, width: 'w-32' },
]

function chargeTypeLabel(t: string) {
  switch (t) {
    case 'rent': return 'Tiền thuê'
    case 'electricity': return 'Điện'
    case 'water': return 'Nước'
    case 'service': return 'Dịch vụ'
    case 'discount': return 'Giảm giá'
    case 'surcharge': return 'Phụ thu'
    case 'adjustment': return 'Điều chỉnh'
    default: return t
  }
}

const lineColumns: UiTableColumn<BillingDraftLine>[] = [
  { key: 'label', label: 'Khoản phí' },
  { key: 'quantity', label: 'SL', numeric: true, hideOnMobile: true, width: 'w-20', accessor: r => r.quantity },
  { key: 'unitPrice', label: 'Đơn giá', numeric: true, hideOnMobile: true, width: 'w-32' },
  { key: 'amount', label: 'Thành tiền', numeric: true, width: 'w-32' },
]
</script>

<template>
  <div class="space-y-4">
    <UiSection
      title="Chỉ số & hoá đơn nháp"
      description="Mỗi phòng một dòng. Nhập chỉ số mới, lưu để tính lại tiền điện/nước và tổng hoá đơn nháp."
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Tải lại</UiButton>
      </template>

      <!-- Toolbar: batch reading date + filters + save -->
      <UiToolbar class="mb-3">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1">
            <label for="batch-reading-date" class="text-xs text-muted">Ngày đọc chỉ số</label>
            <UiInput
              id="batch-reading-date"
              v-model="batchReadingDate"
              type="date"
              class="w-44"
              :disabled="!periodEditable"
            />
          </div>
        </div>
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <UiButton
              v-for="t in filterTabs"
              :key="t.key"
              :variant="filter === t.key ? 'primary' : 'ghost'"
              size="sm"
              @click="filter = t.key"
            >
              {{ t.label }}
            </UiButton>
          </div>
        </template>
      </UiToolbar>

      <!-- Save bar -->
      <div
        v-if="periodEditable"
        class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dark-border bg-dark-surface px-3 py-2"
      >
        <p class="text-sm text-muted">
          <template v-if="dirtyCountValue > 0">
            Đang nhập <span class="font-semibold text-white">{{ dirtyCountValue }}</span> chỉ số. Tự động lưu sau khi dừng gõ.
          </template>
          <template v-else>
            Mọi thay đổi đã được tự động lưu.
          </template>
        </p>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="dirtyCountValue === 0 || isSaving"
          @click="saveAll"
        >
          {{ isSaving ? 'Đang lưu...' : 'Lưu ngay' }}
        </UiButton>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
      </div>

      <!-- Empty -->
      <UiEmptyState
        v-else-if="!response || response.rows.length === 0"
        title="Chưa có phòng"
        description="Toà nhà này chưa có phòng được khai báo."
      />

      <!-- Grid -->
      <UiTable
        v-else
        :columns="columns"
        :rows="filteredRows"
        row-key="key"
        :empty-title="'Không có dòng phù hợp với bộ lọc'"
        :empty-description="'Đổi bộ lọc để xem các dòng khác.'"
        class="hidden md:block"
      >
        <template #cell-order="{ row }">
          <span class="text-xs text-muted">
            {{ filteredRows.indexOf(row as BillingDraftGridRow) + 1 }}
          </span>
        </template>

        <template #cell-expand="{ row }">
          <UiButton
            variant="ghost"
            size="sm"
            class="px-2"
            @click="toggleExpand(row as BillingDraftGridRow)"
          >
            {{ isExpanded(row as BillingDraftGridRow) ? '−' : '+' }}
          </UiButton>
        </template>

        <template #cell-room="{ row }">
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-white">
              {{ (row as BillingDraftGridRow).roomNumber ?? '—' }}
            </span>
            <span v-if="(row as BillingDraftGridRow).floor !== null" class="text-xs text-muted">
              Tầng {{ (row as BillingDraftGridRow).floor }}
            </span>
          </div>
        </template>

        <template #cell-tenant="{ row }">
          <span class="text-sm text-white">
            {{ (row as BillingDraftGridRow).tenantName ?? '—' }}
          </span>
        </template>

        <template #cell-electricity_input="{ row }">
          <div
            v-if="(row as BillingDraftGridRow).electricity"
            class="flex flex-col items-end gap-0.5"
          >
            <p class="text-[10px] text-muted">
              {{ previousReadingHint((row as BillingDraftGridRow).electricity) }}
            </p>
            <UiInput
              v-if="(row as BillingDraftGridRow).electricity!.editable"
              type="number"
              :data-reading-cell="`${(row as BillingDraftGridRow).roomId}::electricity`"
              :model-value="readingDraftValue(row as BillingDraftGridRow, 'electricity')"
              density="compact"
              class="w-28"
              :class="clsx(
                isCellDirty(row as BillingDraftGridRow, 'electricity') && 'ring-2 ring-blue-500',
                isPasteHighlighted(row as BillingDraftGridRow, 'electricity') && 'bg-amber-100/40',
              )"
              @update:model-value="setReadingDraftValue(row as BillingDraftGridRow, 'electricity', String($event ?? ''))"
              @keydown="handleReadingKeydown($event, row as BillingDraftGridRow, 'electricity')"
              @paste="handleReadingPaste($event, row as BillingDraftGridRow, 'electricity')"
            />
            <span v-else class="text-sm text-white tabular-nums">
              {{ (row as BillingDraftGridRow).electricity!.currentValue ?? '—' }}
            </span>
          </div>
          <span v-else class="text-xs text-muted">—</span>
        </template>

        <template #cell-water_input="{ row }">
          <div
            v-if="(row as BillingDraftGridRow).water"
            class="flex flex-col items-end gap-0.5"
          >
            <p class="text-[10px] text-muted">
              {{ previousReadingHint((row as BillingDraftGridRow).water) }}
            </p>
            <UiInput
              v-if="(row as BillingDraftGridRow).water!.editable"
              type="number"
              :data-reading-cell="`${(row as BillingDraftGridRow).roomId}::water`"
              :model-value="readingDraftValue(row as BillingDraftGridRow, 'water')"
              density="compact"
              class="w-28"
              :class="clsx(
                isCellDirty(row as BillingDraftGridRow, 'water') && 'ring-2 ring-blue-500',
                isPasteHighlighted(row as BillingDraftGridRow, 'water') && 'bg-amber-100/40',
              )"
              @update:model-value="setReadingDraftValue(row as BillingDraftGridRow, 'water', String($event ?? ''))"
              @keydown="handleReadingKeydown($event, row as BillingDraftGridRow, 'water')"
              @paste="handleReadingPaste($event, row as BillingDraftGridRow, 'water')"
            />
            <span v-else class="text-sm text-white tabular-nums">
              {{ (row as BillingDraftGridRow).water!.currentValue ?? '—' }}
            </span>
          </div>
          <span v-else class="text-xs text-muted">—</span>
        </template>

        <template #cell-electricity_amount="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm tabular-nums text-white">
              {{ formatCellAmount((row as BillingDraftGridRow).electricity) }}
            </span>
            <span class="text-[10px] text-muted">
              {{ formatUsage((row as BillingDraftGridRow).electricity) }}
            </span>
          </div>
        </template>

        <template #cell-water_amount="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm tabular-nums text-white">
              {{ formatCellAmount((row as BillingDraftGridRow).water) }}
            </span>
            <span class="text-[10px] text-muted">
              {{ formatUsage((row as BillingDraftGridRow).water) }}
            </span>
          </div>
        </template>

        <template #cell-rent_service="{ row }">
          <span class="text-sm tabular-nums text-white">
            {{ (row as BillingDraftGridRow).rowType === 'billable_contract' ? formatCurrency((row as BillingDraftGridRow).rentAndServiceTotal) : '—' }}
          </span>
        </template>

        <template #cell-draft_total="{ row }">
          <span class="text-sm font-semibold tabular-nums text-white">
            {{ (row as BillingDraftGridRow).draftTotal !== null ? formatCurrency((row as BillingDraftGridRow).draftTotal!) : '—' }}
          </span>
        </template>

        <template #cell-status="{ row }">
          <UiStatusBadge
            :status="statusBadgeFor(row as BillingDraftGridRow).status"
            :context="statusBadgeFor(row as BillingDraftGridRow).context"
          />
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-2">
            <span
              v-if="rowSaveStateOf(row as BillingDraftGridRow) === 'saving'"
              class="text-[11px] text-muted"
            >
              Đang lưu…
            </span>
            <span
              v-else-if="rowSaveStateOf(row as BillingDraftGridRow) === 'saved'"
              class="text-[11px] text-emerald-400"
            >
              Đã lưu ✓
            </span>
            <span
              v-else-if="rowSaveStateOf(row as BillingDraftGridRow) === 'error'"
              class="text-[11px] text-rose-400"
              :title="rowSaveError[(row as BillingDraftGridRow).roomId]"
            >
              Lỗi
            </span>
            <UiButton
              v-if="((row as BillingDraftGridRow).electricity?.required || (row as BillingDraftGridRow).water?.required) && (row as BillingDraftGridRow).editable"
              variant="ghost"
              size="sm"
              @click="openOverrideModal(row as BillingDraftGridRow)"
            >
              Điều chỉnh chỉ số
            </UiButton>
          </div>
        </template>
      </UiTable>

      <!-- Mobile cards (stacked) -->
      <div
        v-if="!loading && response && filteredRows.length > 0"
        class="md:hidden space-y-2"
      >
        <BillingMobileDraftRow
          v-for="row in filteredRows"
          :key="row.key"
          :row="row"
          :reading-value-of="readingDraftValue"
          :is-cell-dirty="isCellDirty"
          :is-paste-highlighted="isPasteHighlighted"
          :save-state-of="rowSaveStateOf"
          @update="setReadingDraftValue($event.row, $event.type, $event.value)"
          @keydown="handleReadingKeydown($event.event, $event.row, $event.type)"
          @paste="handleReadingPaste($event.event, $event.row, $event.type)"
          @override="openOverrideModal($event)"
        />
      </div>

      <!-- Expanded row details -->
      <div
        v-for="row in filteredRows.filter(r => isExpanded(r))"
        :key="`detail-${row.key}`"
        class="mt-3 rounded-lg border border-dark-border bg-dark-surface p-4 space-y-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-white">
            Chi tiết phòng {{ row.roomNumber ?? '—' }}
            <span v-if="row.tenantName" class="text-muted">· {{ row.tenantName }}</span>
          </p>
          <UiButton variant="ghost" size="sm" @click="toggleExpand(row)">Đóng</UiButton>
        </div>

        <UiAlert
          v-for="b in row.blockers"
          :key="`b-${b.code}`"
          severity="danger"
          :title="b.code"
        >
          {{ b.message }}
        </UiAlert>
        <UiAlert
          v-for="w in row.warnings"
          :key="`w-${w.code}`"
          severity="warning"
          :title="w.code"
        >
          {{ w.message }}
        </UiAlert>

        <BillingDraftDiscrepancyCallout
          v-if="period"
          :draft="row"
          :period="period"
          @intent:adjustment="$emit('intent:adjustment', $event)"
          @intent:void-reissue="$emit('intent:void-reissue', $event)"
        />

        <UiTable
          v-if="row.lines.length > 0"
          :columns="lineColumns"
          :rows="[...row.lines].sort((a, b) => a.sortOrder - b.sortOrder)"
          row-key="sortOrder"
        >
          <template #cell-label="{ row: line }">
            <span class="text-white">
              {{ chargeTypeLabel((line as BillingDraftLine).chargeType) }}
              <span class="text-muted">· {{ (line as BillingDraftLine).label }}</span>
            </span>
          </template>
          <template #cell-unitPrice="{ row: line }">
            {{ formatCurrency((line as BillingDraftLine).unitPrice) }}
          </template>
          <template #cell-amount="{ row: line }">
            {{ formatCurrency((line as BillingDraftLine).amount) }}
          </template>
        </UiTable>
      </div>

      <!-- Totals footer -->
      <div
        v-if="response"
        class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <UiMetric
          label="Cần đọc"
          :value="`${response.totals.completeReadingCount}/${response.totals.requiredReadingCount}`"
        />
        <UiMetric
          label="Sẵn sàng"
          :value="String(response.totals.readyDraftCount)"
        />
        <UiMetric
          label="Có lỗi"
          :value="String(response.totals.blockedDraftCount)"
        />
        <UiMetric
          label="Tổng nháp"
          :value="formatCurrency(response.totals.draftTotal)"
        />
      </div>
    </UiSection>

    <!-- Override modal -->
    <UiModal :open="overrideOpen" title="Điều chỉnh chỉ số" size="lg" @close="closeOverrideModal">
      <div v-if="overrideRow" class="space-y-4">
        <p class="text-sm text-muted">
          Phòng <span class="font-semibold text-white">P{{ overrideRow.roomNumber ?? '—' }}</span>
          <span v-if="overrideRow.tenantName"> · {{ overrideRow.tenantName }}</span>
        </p>

        <p v-if="electricityRequired && waterRequired" class="text-xs text-muted">
          Có thể bật cùng lúc cả hai loại đồng hồ để điều chỉnh trong một thao tác.
        </p>

        <!-- Electricity panel -->
        <div
          v-if="electricityRequired"
          class="rounded-lg border border-dark-border bg-dark-surface p-3 space-y-3"
        >
          <UiCheckbox
            :model-value="overrideElectricity.enabled"
            label="Điều chỉnh đồng hồ điện"
            @update:model-value="overrideElectricity.enabled = $event"
          />

          <template v-if="overrideElectricity.enabled">
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Chỉ số kỳ trước</label>
                <UiInput v-model="overrideElectricity.previousValue" type="number" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Chỉ số kỳ này</label>
                <UiInput v-model="overrideElectricity.currentValue" type="number" />
              </div>
              <div
                v-if="overrideElectricity.reason === 'replacement' || overrideElectricity.reason === 'reset'"
                class="flex flex-col gap-1"
              >
                <label class="text-xs text-muted">
                  {{ overrideElectricity.reason === 'reset' ? 'Số cuối trước khi nhảy về 0' : 'Số cuối đồng hồ cũ' }}
                </label>
                <UiInput v-model="overrideElectricity.oldMeterFinal" type="number" />
              </div>
              <div
                v-if="overrideElectricity.reason === 'replacement'"
                class="flex flex-col gap-1"
              >
                <label class="text-xs text-muted">Số đầu đồng hồ mới</label>
                <UiInput v-model="overrideElectricity.newMeterStart" type="number" />
              </div>
              <div class="flex flex-col gap-1 col-span-2">
                <label class="text-xs text-muted">
                  Tiêu thụ tính tiền (kWh)
                  <span v-if="overrideElectricity.reason !== 'manual_adjustment'" class="text-muted">(tự tính)</span>
                </label>
                <UiInput
                  v-model="overrideElectricity.billableUsage"
                  type="number"
                  :disabled="overrideElectricity.reason !== 'manual_adjustment'"
                />
                <p v-if="overrideElectricity.reason !== 'manual_adjustment' && electricityBillable.missing.length > 0" class="text-xs text-warning">
                  Cần điền: {{ electricityBillable.missing.join(', ') }}
                </p>
                <p v-else-if="overrideElectricity.reason !== 'manual_adjustment' && electricityBillable.value !== null && electricityBillable.value < 0" class="text-xs text-error-vivid">
                  Kết quả âm ({{ electricityBillable.value }}) — kiểm tra lại các chỉ số.
                </p>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Lý do</label>
                <UiSelect
                  v-model="overrideElectricity.reason"
                  :options="[
                    { value: 'replacement', label: 'Thay đồng hồ' },
                    { value: 'reset', label: 'Đồng hồ nhảy về 0' },
                    { value: 'correction', label: 'Đính chính chỉ số sai' },
                    { value: 'manual_adjustment', label: 'Điều chỉnh thủ công' },
                    { value: 'normal', label: 'Bình thường' },
                  ]"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Ghi chú</label>
                <UiInput v-model="overrideElectricity.note" />
              </div>
            </div>
          </template>
        </div>

        <!-- Water panel -->
        <div
          v-if="waterRequired"
          class="rounded-lg border border-dark-border bg-dark-surface p-3 space-y-3"
        >
          <UiCheckbox
            :model-value="overrideWater.enabled"
            label="Điều chỉnh đồng hồ nước"
            @update:model-value="overrideWater.enabled = $event"
          />
          <template v-if="overrideWater.enabled">
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Chỉ số kỳ trước</label>
                <UiInput v-model="overrideWater.previousValue" type="number" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Chỉ số kỳ này</label>
                <UiInput v-model="overrideWater.currentValue" type="number" />
              </div>
              <div
                v-if="overrideWater.reason === 'replacement' || overrideWater.reason === 'reset'"
                class="flex flex-col gap-1"
              >
                <label class="text-xs text-muted">
                  {{ overrideWater.reason === 'reset' ? 'Số cuối trước khi nhảy về 0' : 'Số cuối đồng hồ cũ' }}
                </label>
                <UiInput v-model="overrideWater.oldMeterFinal" type="number" />
              </div>
              <div
                v-if="overrideWater.reason === 'replacement'"
                class="flex flex-col gap-1"
              >
                <label class="text-xs text-muted">Số đầu đồng hồ mới</label>
                <UiInput v-model="overrideWater.newMeterStart" type="number" />
              </div>
              <div class="flex flex-col gap-1 col-span-2">
                <label class="text-xs text-muted">
                  Tiêu thụ tính tiền (m³)
                  <span v-if="overrideWater.reason !== 'manual_adjustment'" class="text-muted">(tự tính)</span>
                </label>
                <UiInput
                  v-model="overrideWater.billableUsage"
                  type="number"
                  :disabled="overrideWater.reason !== 'manual_adjustment'"
                />
                <p v-if="overrideWater.reason !== 'manual_adjustment' && waterBillable.missing.length > 0" class="text-xs text-warning">
                  Cần điền: {{ waterBillable.missing.join(', ') }}
                </p>
                <p v-else-if="overrideWater.reason !== 'manual_adjustment' && waterBillable.value !== null && waterBillable.value < 0" class="text-xs text-error-vivid">
                  Kết quả âm ({{ waterBillable.value }}) — kiểm tra lại các chỉ số.
                </p>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Lý do</label>
                <UiSelect
                  v-model="overrideWater.reason"
                  :options="[
                    { value: 'replacement', label: 'Thay đồng hồ' },
                    { value: 'reset', label: 'Đồng hồ nhảy về 0' },
                    { value: 'correction', label: 'Đính chính chỉ số sai' },
                    { value: 'manual_adjustment', label: 'Điều chỉnh thủ công' },
                    { value: 'normal', label: 'Bình thường' },
                  ]"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted">Ghi chú</label>
                <UiInput v-model="overrideWater.note" />
              </div>
            </div>
          </template>
        </div>

        <UiAlert v-if="overrideError" severity="danger" :title="'Lỗi'">
          {{ overrideError }}
        </UiAlert>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="closeOverrideModal">Huỷ</UiButton>
        <UiButton variant="primary" :disabled="overrideSaving" @click="submitOverride">
          {{ overrideSaving ? 'Đang lưu...' : 'Lưu điều chỉnh' }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
