<script setup lang="ts">
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
}>()

// ---------------------------------------------------------------------------
// Period editability
// ---------------------------------------------------------------------------

const periodEditable = computed(() => props.period?.status !== 'closed')

// ---------------------------------------------------------------------------
// Toolbar state
// ---------------------------------------------------------------------------

const filter = ref<GridFilter>('needs_action')
const batchReadingDate = ref<string>('')
const expandedRowKeys = ref<Set<string>>(new Set())
const localReadings = ref<Record<string, string>>({}) // key = `${roomId}::${meterType}`
const isSaving = ref(false)

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

function applyBatchDateToEmpty() {
  // Empty rows pick up the batch date at save time via saveAll(). This button
  // exists so the user has an explicit confirmation surface; no client state
  // needs to mutate before save because the date is read just-in-time.
  // Intentionally a no-op visual confirmation.
}

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

const overrideOpen = ref(false)
const overrideRow = ref<BillingDraftGridRow | null>(null)
const overrideMeterType = ref<MeterType>('electricity')
const overridePreviousReadingId = ref<string | null>(null)
const overridePreviousValue = ref<string>('')
const overrideCurrentReadingId = ref<string | null>(null)
const overrideCurrentValue = ref<string>('')
const overrideOldMeterFinal = ref<string>('')
const overrideNewMeterStart = ref<string>('')
const overrideBillableUsage = ref<string>('')
const overrideReason = ref<'normal' | 'replacement' | 'reset' | 'correction' | 'manual_adjustment'>('replacement')
const overrideNote = ref<string>('')
const overrideError = ref<string | null>(null)
const overrideSaving = ref(false)

function openOverrideModal(row: BillingDraftGridRow, type: MeterType) {
  if (!row.editable) return
  const cell = type === 'electricity' ? row.electricity : row.water
  if (!cell) return
  overrideRow.value = row
  overrideMeterType.value = type
  overridePreviousReadingId.value = cell.previousReadingId
  overridePreviousValue.value = cell.previousValue !== null ? String(cell.previousValue) : ''
  overrideCurrentReadingId.value = cell.currentReadingId
  overrideCurrentValue.value = cell.currentValue !== null ? String(cell.currentValue) : ''
  overrideOldMeterFinal.value = ''
  overrideNewMeterStart.value = ''
  overrideBillableUsage.value = cell.usage !== null ? String(Math.max(cell.usage, 0)) : ''
  overrideReason.value = 'replacement'
  overrideNote.value = ''
  overrideError.value = null
  overrideOpen.value = true
}

function closeOverrideModal() {
  overrideOpen.value = false
  overrideRow.value = null
}

async function submitOverride() {
  if (!overrideRow.value) return
  const billable = Number(overrideBillableUsage.value)
  const prev = Number(overridePreviousValue.value)
  const curr = Number(overrideCurrentValue.value)
  if (!Number.isFinite(billable) || billable < 0) {
    overrideError.value = 'Tiêu thụ tính tiền phải >= 0'
    return
  }
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) {
    overrideError.value = 'Giá trị chỉ số không hợp lệ'
    return
  }
  if (overrideReason.value !== 'normal' && overrideNote.value.trim().length === 0) {
    overrideError.value = 'Cần ghi rõ lý do điều chỉnh'
    return
  }
  overrideError.value = null
  overrideSaving.value = true
  try {
    const oldFinal = overrideOldMeterFinal.value.trim()
    const newStart = overrideNewMeterStart.value.trim()
    await props.onSaveOverride({
      room_id: overrideRow.value.roomId,
      meter_type: overrideMeterType.value,
      previous_reading_id: overridePreviousReadingId.value,
      previous_reading_value: prev,
      current_reading_id: overrideCurrentReadingId.value,
      current_reading_value: curr,
      old_meter_final_value: oldFinal === '' ? null : Number(oldFinal),
      new_meter_start_value: newStart === '' ? null : Number(newStart),
      billable_usage: billable,
      reason: overrideReason.value,
      note: overrideNote.value.trim() === '' ? null : overrideNote.value.trim(),
    })
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
  { key: 'tenant', label: 'Khách thuê', hideOnMobile: true },
  { key: 'electricity_input', label: 'Số điện mới', numeric: true, hideOnMobile: true, width: 'w-32' },
  { key: 'water_input', label: 'Số nước mới', numeric: true, hideOnMobile: true, width: 'w-32' },
  { key: 'electricity_amount', label: 'Tiền điện', numeric: true, hideOnMobile: true, width: 'w-36' },
  { key: 'water_amount', label: 'Tiền nước', numeric: true, hideOnMobile: true, width: 'w-36' },
  { key: 'rent_service', label: 'Phòng/Dịch vụ', numeric: true, hideOnMobile: true, width: 'w-36' },
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
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="!periodEditable || !batchReadingDate"
            @click="applyBatchDateToEmpty"
          >
            Áp dụng cho dòng trống
          </UiButton>
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
            Có <span class="font-semibold text-white">{{ dirtyCountValue }}</span> chỉ số chưa lưu.
          </template>
          <template v-else>
            Không có thay đổi chưa lưu.
          </template>
        </p>
        <UiButton
          variant="primary"
          size="sm"
          :disabled="dirtyCountValue === 0 || isSaving"
          @click="saveAll"
        >
          {{ isSaving ? 'Đang lưu...' : 'Lưu & tính lại' }}
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
              P{{ (row as BillingDraftGridRow).roomNumber ?? '—' }}
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
              :model-value="readingDraftValue(row as BillingDraftGridRow, 'electricity')"
              density="compact"
              class="w-28"
              :class="clsx(isCellDirty(row as BillingDraftGridRow, 'electricity') && 'ring-2 ring-blue-500')"
              @update:model-value="setReadingDraftValue(row as BillingDraftGridRow, 'electricity', String($event ?? ''))"
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
              :model-value="readingDraftValue(row as BillingDraftGridRow, 'water')"
              density="compact"
              class="w-28"
              :class="clsx(isCellDirty(row as BillingDraftGridRow, 'water') && 'ring-2 ring-blue-500')"
              @update:model-value="setReadingDraftValue(row as BillingDraftGridRow, 'water', String($event ?? ''))"
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
          <div class="flex items-center justify-end gap-1">
            <UiButton
              v-if="(row as BillingDraftGridRow).electricity && (row as BillingDraftGridRow).electricity!.required && (row as BillingDraftGridRow).editable"
              variant="ghost"
              size="sm"
              @click="openOverrideModal(row as BillingDraftGridRow, 'electricity')"
            >
              Điều chỉnh điện
            </UiButton>
            <UiButton
              v-if="(row as BillingDraftGridRow).water && (row as BillingDraftGridRow).water!.required && (row as BillingDraftGridRow).editable"
              variant="ghost"
              size="sm"
              @click="openOverrideModal(row as BillingDraftGridRow, 'water')"
            >
              Điều chỉnh nước
            </UiButton>
          </div>
        </template>
      </UiTable>

      <!-- Expanded row details -->
      <div
        v-for="row in filteredRows.filter(r => isExpanded(r))"
        :key="`detail-${row.key}`"
        class="mt-3 rounded-lg border border-dark-border bg-dark-surface p-4 space-y-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-white">
            Chi tiết phòng P{{ row.roomNumber ?? '—' }}
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
    <UiModal :open="overrideOpen" title="Điều chỉnh tiêu thụ" @close="closeOverrideModal">
      <div v-if="overrideRow" class="space-y-3">
        <p class="text-sm text-muted">
          Phòng <span class="font-semibold text-white">P{{ overrideRow.roomNumber ?? '—' }}</span>
          <span v-if="overrideRow.tenantName"> · {{ overrideRow.tenantName }}</span>
          · {{ overrideMeterType === 'electricity' ? 'Điện' : 'Nước' }}
        </p>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="ovr-prev" class="text-xs text-muted">Chỉ số kỳ trước</label>
            <UiInput id="ovr-prev" v-model="overridePreviousValue" type="number" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="ovr-curr" class="text-xs text-muted">Chỉ số kỳ này</label>
            <UiInput id="ovr-curr" v-model="overrideCurrentValue" type="number" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="ovr-old" class="text-xs text-muted">Số cuối đồng hồ cũ</label>
            <UiInput id="ovr-old" v-model="overrideOldMeterFinal" type="number" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="ovr-new" class="text-xs text-muted">Số đầu đồng hồ mới</label>
            <UiInput id="ovr-new" v-model="overrideNewMeterStart" type="number" />
          </div>
          <div class="flex flex-col gap-1 col-span-2">
            <label for="ovr-billable" class="text-xs text-muted">Tiêu thụ tính tiền</label>
            <UiInput id="ovr-billable" v-model="overrideBillableUsage" type="number" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label for="ovr-reason" class="text-xs text-muted">Lý do</label>
          <UiSelect
            id="ovr-reason"
            v-model="overrideReason"
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
          <label for="ovr-note" class="text-xs text-muted">Ghi chú</label>
          <UiTextarea id="ovr-note" v-model="overrideNote" :rows="3" />
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
