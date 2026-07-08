<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import clsx from 'clsx'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import BillingDraftGridExpandedRow from '~/components/billing/BillingDraftGridExpandedRow.vue'
import BillingDraftGridOverrideModal from '~/components/billing/BillingDraftGridOverrideModal.vue'
import BillingAutoIssueModal from '~/components/billing/BillingAutoIssueModal.vue'
import type {
  BillingDraftGridResponse,
  BillingDraftGridRow,
  BillingDraftGridUtilityCell,
  BillingPeriod,
  Invoice,
  IssueInvoicesResult,
  BillingUtilityUsage,
} from '~/types/billing'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'
import type { IssueInvoicesInput, UtilityUsageOverrideInput } from '~/utils/validators/billing'
import type { IssueAndPayInput } from '~/utils/validators/billing-issue-pay'
import { formatCurrency } from '~/utils/format/currency'
import { isPeriodLocked } from '~/utils/billing/lock'
import {
  formatOptimisticUsage,
  optimisticRowDisplay,
  type OptimisticUtilityDisplay,
} from '~/utils/billing/draft-grid-optimistic'
import { useBillingDraftGridAutosave } from '~/composables/billing/useBillingDraftGridAutosave'
import { useBillingDraftGridFilters } from '~/composables/billing/useBillingDraftGridFilters'
import { useBillingDraftGridNavigation } from '~/composables/billing/useBillingDraftGridNavigation'

type MeterType = 'electricity' | 'water'

const props = defineProps<{
  response: BillingDraftGridResponse | null
  loading: boolean
  period: BillingPeriod | null
  unapprovedOverrides?: BillingUtilityUsage[]
  onSaveReadings: (
    readings: MeterReadingBulkInput['readings'],
    options?: { refresh?: boolean; silent?: boolean; refreshDrafts?: boolean },
  ) => Promise<void>
  onSaveOverride: (input: UtilityUsageOverrideInput) => Promise<void>
  onDeleteOverride: (overrideId: string) => Promise<void>
  onApproveOverride?: (overrideId: string) => Promise<BillingUtilityUsage>
  onIssue?: (input: IssueInvoicesInput) => Promise<IssueInvoicesResult | undefined>
  onAutoIssue?: (input: IssueAndPayInput) => Promise<Invoice | undefined>
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
  (e: 'intent:print', payload: { keys: string[] }): void
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

const batchReadingDate = ref<string>('')
const bulkEntryOpen = ref(false)
const overrideOpen = ref(false)
const overrideRow = ref<BillingDraftGridRow | null>(null)
const overrideType = ref<MeterType | null>(null)

const draftGridResponse = computed(() => props.response)
const draftGridPeriod = computed(() => props.period)

const {
  filter,
  filterTabs,
  filteredRows,
  detailRow,
  isDetailOpen,
  toggleDetail,
  closeDetail,
  selectedCount,
  selectedRows,
  allVisibleSelected,
  someVisibleSelected,
  isSelectable,
  isSelected,
  toggleSelect,
  selectAllVisible,
  toggleSelectAllVisible,
  clearSelection,
} = useBillingDraftGridFilters(draftGridResponse)

function requestPrint() {
  if (selectedCount.value === 0) return
  emit('intent:print', { keys: selectedRows.value.map(row => row.key) })
}

// ---------------------------------------------------------------------------
// Bulk issue (merged from the former "Phát hành" tab)
// ---------------------------------------------------------------------------

const issuableSelectedRows = computed<BillingDraftGridRow[]>(() =>
  selectedRows.value.filter(row => !!row.contractId && !row.invoiceId),
)
const issuableSelectedCount = computed(() => issuableSelectedRows.value.length)
const issuableSelectedTotal = computed(() =>
  issuableSelectedRows.value.reduce((sum, row) => sum + (row.draftTotal ?? 0), 0),
)

const issueConfirmOpen = ref(false)
const issueSubmitting = ref(false)
const approveOverridesOpen = ref(false)
const approvingOverrides = ref<BillingUtilityUsage[]>([])
const approvingInProgress = ref(false)
const overridesToApprove = computed(() => props.unapprovedOverrides ?? [])

function startIssue() {
  if (issuableSelectedCount.value === 0) return
  // Check for unapproved overrides
  if (overridesToApprove.value.length > 0) {
    approvingOverrides.value = overridesToApprove.value
    approveOverridesOpen.value = true
    return
  }
  issueConfirmOpen.value = true
}

async function approveAllOverrides() {
  if (!props.onApproveOverride || approvingOverrides.value.length === 0) return
  approvingInProgress.value = true
  try {
    for (const override of approvingOverrides.value) {
      await props.onApproveOverride(override.id)
    }
    approveOverridesOpen.value = false
    approvingOverrides.value = []
    // Now show the issue confirm dialog
    issueConfirmOpen.value = true
  }
  catch (err) {
    console.error('Failed to approve overrides:', err)
  }
  finally {
    approvingInProgress.value = false
  }
}

async function confirmIssue() {
  if (!props.onIssue || issuableSelectedCount.value === 0) return
  issueSubmitting.value = true
  try {
    const contractIds = issuableSelectedRows.value
      .map(row => row.contractId)
      .filter((id): id is string => !!id)
    await props.onIssue({ contract_ids: contractIds })
    issueConfirmOpen.value = false
    clearSelection()
    emit('refresh')
  }
  finally {
    issueSubmitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Single-row auto-issue (issue + full payment in one step). Feature-flagged.
// ---------------------------------------------------------------------------

const autoIssueEnabled = computed(() => useRuntimeConfig().public.billingAutoIssueEnabled === true)
const periodLocked = computed(() => isPeriodLocked(props.period))

const autoIssueRow = ref<BillingDraftGridRow | null>(null)
const autoIssueOpen = ref(false)
const autoIssueSubmitting = ref(false)

function canAutoIssue(row: BillingDraftGridRow): boolean {
  return autoIssueEnabled.value
    && !periodLocked.value
    && row.status === 'ready'
    && !!row.contractId
    && !row.invoiceId
}

function startAutoIssue(row: BillingDraftGridRow) {
  if (!canAutoIssue(row)) return
  autoIssueRow.value = row
  autoIssueOpen.value = true
}

function closeAutoIssue() {
  autoIssueOpen.value = false
  autoIssueRow.value = null
}

async function submitAutoIssue(payload: { payment_date: string; payment_method: string | null; note: string | null }) {
  const row = autoIssueRow.value
  if (!props.onAutoIssue || !row?.contractId) return
  autoIssueSubmitting.value = true
  try {
    const result = await props.onAutoIssue({
      contract_id: row.contractId,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      note: payload.note,
    })
    if (result) {
      closeAutoIssue()
      emit('refresh')
    }
  }
  finally {
    autoIssueSubmitting.value = false
  }
}

watch(
  () => props.response?.batchReadingDate,
  (next) => {
    if (next && !batchReadingDate.value) batchReadingDate.value = next
  },
  { immediate: true },
)

const {
  effectiveReadings,
  isSaving,
  rowSaveError,
  readingDraftValue,
  setReadingDraftValue,
  saveAll,
  rowSaveStateOf,
  isCellDirty,
  dirtyCountValue,
} = useBillingDraftGridAutosave({
  response: draftGridResponse,
  period: draftGridPeriod,
  periodEditable,
  batchReadingDate,
  onSaveReadings: props.onSaveReadings,
})

const {
  isPasteHighlighted,
  handleReadingKeydown,
  handleReadingPaste,
  highlightReadingCells,
  cellKey,
} = useBillingDraftGridNavigation({
  filteredRows,
  setReadingDraftValue,
})

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

function rowDisplay(row: BillingDraftGridRow) {
  return optimisticRowDisplay(row, effectiveReadings.value)
}

function utilityDisplay(row: BillingDraftGridRow, type: MeterType): OptimisticUtilityDisplay {
  const display = rowDisplay(row)
  return type === 'electricity' ? display.electricity : display.water
}

function formatDisplayAmount(display: OptimisticUtilityDisplay): string {
  return display.amount !== null ? formatCurrency(display.amount) : '—'
}

function displayDraftTotal(row: BillingDraftGridRow): number | null {
  return rowDisplay(row).draftTotal
}

const displayGridRowMap = computed<Map<string, BillingDraftGridRow>>(() => {
  const map = new Map<string, BillingDraftGridRow>()
  for (const row of props.response?.rows ?? []) {
    const display = optimisticRowDisplay(row, effectiveReadings.value)
    map.set(row.roomId, {
      ...row,
      draftTotal: display.draftTotal,
      electricity: row.electricity
        ? {
            ...row.electricity,
            currentValue: display.electricity.currentValue,
            usage: display.electricity.usage,
            amount: display.electricity.amount,
          }
        : null,
      water: row.water
        ? {
            ...row.water,
            currentValue: display.water.currentValue,
            usage: display.water.usage,
            amount: display.water.amount,
          }
        : null,
    })
  }
  return map
})

function displayGridRow(row: BillingDraftGridRow): BillingDraftGridRow {
  return displayGridRowMap.value.get(row.roomId) ?? row
}

function previousReadingHint(cell: BillingDraftGridUtilityCell | null): string {
  if (!cell || cell.previousValue === null) return '—'
  return `Kỳ trước · ${cell.previousValue}`
}

function applyBulkReadings(updates: Array<{ row: BillingDraftGridRow; type: MeterType; value: string }>) {
  const keys: string[] = []
  for (const update of updates) {
    setReadingDraftValue(update.row, update.type, update.value)
    keys.push(cellKey(update.row, update.type))
  }
  highlightReadingCells(keys)
}

defineExpose({ applyBulkReadings })

// ---------------------------------------------------------------------------
// Override modal coordination
// ---------------------------------------------------------------------------

function openOverrideModal(row: BillingDraftGridRow, type?: MeterType) {
  if (!row.editable) return
  const hasElec = !!row.electricity?.required
  const hasWater = !!row.water?.required
  if (!hasElec && !hasWater) return
  overrideRow.value = row
  overrideType.value = type ?? null
  overrideOpen.value = true
}

function closeOverrideModal() {
  overrideOpen.value = false
  overrideRow.value = null
  overrideType.value = null
}

// ---------------------------------------------------------------------------
// Table columns (desktop)
// ---------------------------------------------------------------------------

const columns: UiTableColumn<BillingDraftGridRow>[] = [
  { key: 'select', label: '', action: true, width: 'w-10' },
  { key: 'room', label: 'Phòng & khách thuê' },
  { key: 'electricity_input', label: 'Điện mới', numeric: true, width: 'w-32' },
  { key: 'water_input', label: 'Nước mới', numeric: true, width: 'w-32' },
  { key: 'electricity_amount', label: 'Tiền điện', numeric: true, width: 'w-36' },
  { key: 'water_amount', label: 'Tiền nước', numeric: true, width: 'w-36' },
  { key: 'rent_service', label: 'Phòng & DV', numeric: true, width: 'w-32' },
  { key: 'draft_total', label: 'Tổng nháp', numeric: true, width: 'w-40' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'actions', label: '', action: true, width: 'w-40' },
]
</script>

<template>
  <div class="space-y-4">
    <UiSection
      title="Soạn kỳ"
      description="Mỗi phòng một dòng. Nhập chỉ số mới, lưu để tính lại tiền điện/nước và tổng hoá đơn nháp."
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Tải lại</UiButton>
      </template>

      <!-- Toolbar: batch reading date + filters -->
      <UiToolbar>
        <div class="flex flex-wrap items-center gap-3">
          <label for="batch-reading-date" class="flex items-center gap-2 text-xs text-muted">
            Ngày đọc
            <UiInput
              id="batch-reading-date"
              v-model="batchReadingDate"
              type="date"
              class="w-40"
              :disabled="!periodEditable"
            />
          </label>
          <UiButton
            v-if="periodEditable"
            variant="ghost"
            size="sm"
            @click="bulkEntryOpen = true"
          >
            Nhập nhanh
          </UiButton>
        </div>
        <template #actions>
          <div
            role="tablist"
            aria-label="Lọc dòng theo trạng thái"
            class="inline-flex items-center rounded-lg border border-dark-border bg-dark-card p-0.5"
          >
            <UiButton
              v-for="t in filterTabs"
              :key="t.key"
              unstyled
              role="tab"
              :aria-selected="filter === t.key"
              :class="clsx(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30',
                filter === t.key
                  ? 'bg-dark-hover text-white'
                  : 'text-muted hover:text-white',
              )"
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
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dark-border bg-dark-surface px-3 py-2"
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

      <!-- Selection action bar -->
      <div
        v-if="selectedCount > 0"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan/40 bg-cyan/5 px-3 py-2 text-sm"
      >
        <p class="text-white">
          Đã chọn <span class="font-semibold tabular-nums">{{ selectedCount }}</span> phiếu
          <UiButton
            v-if="!allVisibleSelected"
            unstyled
            class="ml-2 text-xs text-cyan hover:underline"
            @click="selectAllVisible"
          >
            Chọn tất cả trong lọc
          </UiButton>
        </p>
        <div class="flex items-center gap-2">
          <UiButton variant="ghost" size="sm" @click="clearSelection">Bỏ chọn</UiButton>
          <UiButton variant="secondary" size="sm" @click="requestPrint">In phiếu</UiButton>
          <UiButton
            v-if="onIssue && issuableSelectedCount > 0"
            variant="primary"
            size="sm"
            @click="startIssue"
          >
            Phát hành ({{ issuableSelectedCount }})
          </UiButton>
        </div>
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
        <template #header-select>
          <UiCheckbox
            :model-value="allVisibleSelected"
            :indeterminate="someVisibleSelected"
            aria-label="Chọn tất cả phòng để in"
            @update:model-value="toggleSelectAllVisible"
          />
        </template>

        <template #cell-select="{ row }">
          <UiCheckbox
            v-if="isSelectable(row as BillingDraftGridRow)"
            :model-value="isSelected(row as BillingDraftGridRow)"
            :aria-label="`Chọn phòng ${(row as BillingDraftGridRow).roomNumber ?? ''} để in`"
            @update:model-value="toggleSelect(row as BillingDraftGridRow)"
          />
        </template>

        <template #cell-room="{ row }">
          <div class="flex items-start gap-2">
            <UiButton
              unstyled
              class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-dark-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-border"
              :aria-label="isDetailOpen(row as BillingDraftGridRow) ? 'Thu gọn chi tiết' : 'Xem chi tiết'"
              :aria-expanded="isDetailOpen(row as BillingDraftGridRow)"
              @click="toggleDetail(row as BillingDraftGridRow)"
            >
              <IconChevronRight
                class="h-3.5 w-3.5 transition-transform"
                :class="isDetailOpen(row as BillingDraftGridRow) && 'rotate-90'"
                aria-hidden="true"
              />
            </UiButton>
            <div class="flex min-w-0 flex-col leading-tight">
              <span class="text-sm font-semibold text-white">
                {{ (row as BillingDraftGridRow).roomNumber ?? '—' }}
                <span v-if="(row as BillingDraftGridRow).floor !== null" class="ml-1 text-xs font-normal text-muted">
                  · Tầng {{ (row as BillingDraftGridRow).floor }}
                </span>
              </span>
              <span class="truncate text-xs text-muted">
                {{ (row as BillingDraftGridRow).tenantName ?? 'Chưa có khách' }}
              </span>
            </div>
          </div>
        </template>

        <template #cell-electricity_input="{ row }">
          <div
            v-if="(row as BillingDraftGridRow).electricity"
            class="flex flex-col items-end gap-1"
          >
            <UiInput
              v-if="(row as BillingDraftGridRow).electricity!.editable"
              type="number"
              number-mode="meter"
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
            <p class="text-[10px] leading-none text-muted tabular-nums">
              {{ previousReadingHint((row as BillingDraftGridRow).electricity) }}
            </p>
          </div>
          <span v-else class="text-xs text-muted">—</span>
        </template>

        <template #cell-water_input="{ row }">
          <div
            v-if="(row as BillingDraftGridRow).water"
            class="flex flex-col items-end gap-1"
          >
            <UiInput
              v-if="(row as BillingDraftGridRow).water!.editable"
              type="number"
              number-mode="meter"
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
            <p class="text-[10px] leading-none text-muted tabular-nums">
              {{ previousReadingHint((row as BillingDraftGridRow).water) }}
            </p>
          </div>
          <span v-else class="text-xs text-muted">—</span>
        </template>

        <template #cell-electricity_amount="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm tabular-nums text-white">
              {{ formatDisplayAmount(utilityDisplay(row as BillingDraftGridRow, 'electricity')) }}
            </span>
            <span class="text-[10px] text-muted">
              {{ formatOptimisticUsage(utilityDisplay(row as BillingDraftGridRow, 'electricity')) }}
            </span>
          </div>
        </template>

        <template #cell-water_amount="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm tabular-nums text-white">
              {{ formatDisplayAmount(utilityDisplay(row as BillingDraftGridRow, 'water')) }}
            </span>
            <span class="text-[10px] text-muted">
              {{ formatOptimisticUsage(utilityDisplay(row as BillingDraftGridRow, 'water')) }}
            </span>
          </div>
        </template>

        <template #cell-rent_service="{ row }">
          <span class="text-sm tabular-nums text-white">
            {{ (row as BillingDraftGridRow).rowType === 'billable_contract' ? formatCurrency((row as BillingDraftGridRow).rentAndServiceTotal) : '—' }}
          </span>
        </template>

        <template #cell-draft_total="{ row }">
          <div class="flex items-center justify-end gap-2.5">
            <span class="hidden h-5 w-[2px] rounded-full bg-cyan/60 md:inline-block" aria-hidden="true" />
            <span class="text-[15px] font-semibold tabular-nums text-white">
              {{ displayDraftTotal(row as BillingDraftGridRow) !== null ? formatCurrency(displayDraftTotal(row as BillingDraftGridRow)!) : '—' }}
            </span>
          </div>
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
            <UiButton
              v-if="onAutoIssue && canAutoIssue(row as BillingDraftGridRow)"
              variant="primary"
              size="sm"
              @click="startAutoIssue(row as BillingDraftGridRow)"
            >
              Đã thu
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
          :row="displayGridRow(row)"
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

      <!-- Detail drawer -->
      <UiDrawer
        :model-value="detailRow !== null"
        :title="detailRow ? `Chi tiết phòng ${detailRow.roomNumber ?? '—'}` : 'Chi tiết dòng'"
        width="w-full sm:w-[480px]"
        @update:model-value="(open) => { if (!open) closeDetail() }"
      >
        <BillingDraftGridExpandedRow
          v-if="detailRow"
          :row="detailRow"
          :period="period"
          @close="closeDetail"
          @intent:void-reissue="$emit('intent:void-reissue', $event)"
        />
      </UiDrawer>

      <!-- Inline summary -->
      <p
        v-if="response && (response.totals.readyDraftCount > 0 || response.totals.blockedDraftCount > 0)"
        class="mt-4 text-xs text-muted"
      >
        <span>Sẵn sàng: <span class="text-emerald-400 tabular-nums">{{ response.totals.readyDraftCount }}</span></span>
        <span class="mx-2 text-dark-border">·</span>
        <span>Có lỗi: <span :class="response.totals.blockedDraftCount > 0 ? 'text-rose-400 tabular-nums' : 'text-white tabular-nums'">{{ response.totals.blockedDraftCount }}</span></span>
      </p>
    </UiSection>

    <BillingDraftGridOverrideModal
      :open="overrideOpen"
      :row="overrideRow"
      :initial-type="overrideType"
      :on-save-override="props.onSaveOverride"
      :on-delete-override="props.onDeleteOverride"
      @close="closeOverrideModal"
    />
    <BillingBulkReadingEntryModal
      :open="bulkEntryOpen"
      :rows="filteredRows"
      @close="bulkEntryOpen = false"
      @apply="applyBulkReadings"
    />
    <UiModal
      :open="approveOverridesOpen"
      title="Duyệt các điều chỉnh"
      size="md"
      @close="approveOverridesOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Cần duyệt <span class="font-semibold text-white">{{ approvingOverrides.length }}</span> điều chỉnh trước khi phát hành:
        </p>
        <div class="max-h-80 space-y-2 overflow-y-auto">
          <div
            v-for="override in approvingOverrides"
            :key="override.id"
            class="rounded-lg border border-dark-border bg-dark-card p-3"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-muted">{{ override.meterType === 'electricity' ? 'Điện' : 'Nước' }}</p>
                <p class="text-sm font-semibold text-white">{{ override.previousReadingValue }} → {{ override.currentReadingValue }}</p>
                <p class="text-xs text-muted">Tiêu thụ: {{ override.billableUsage }} <span v-if="override.meterType === 'electricity'">kWh</span><span v-else>m³</span></p>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="approvingInProgress"
            @click="approveOverridesOpen = false"
          >
            Huỷ
          </UiButton>
          <UiButton
            variant="primary"
            size="sm"
            :loading="approvingInProgress"
            @click="approveAllOverrides"
          >
            Duyệt tất cả & Phát hành
          </UiButton>
        </div>
      </div>
    </UiModal>
    <UiConfirmModal
      :open="issueConfirmOpen"
      title="Xác nhận phát hành"
      :message="`Phát hành ${issuableSelectedCount} hoá đơn với tổng giá trị ${formatCurrency(issuableSelectedTotal)}. Hành động này không thể hoàn tác — chỉ có thể huỷ từng hoá đơn riêng lẻ.`"
      confirm-label="Phát hành"
      :loading="issueSubmitting"
      @confirm="confirmIssue"
      @cancel="issueConfirmOpen = false"
    />
    <BillingAutoIssueModal
      :open="autoIssueOpen"
      :row="autoIssueRow"
      :submitting="autoIssueSubmitting"
      @close="closeAutoIssue"
      @submit="submitAutoIssue"
    />
  </div>
</template>
