<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import clsx from 'clsx'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import BillingDraftGridExpandedRow from '~/components/billing/BillingDraftGridExpandedRow.vue'
import BillingDraftGridOverrideModal from '~/components/billing/BillingDraftGridOverrideModal.vue'
import type {
  BillingDraftGridResponse,
  BillingDraftGridRow,
  BillingDraftGridUtilityCell,
  BillingPeriod,
} from '~/types/billing'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'
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
  onSaveReadings: (
    readings: MeterReadingBulkInput['readings'],
    options?: { refresh?: boolean; silent?: boolean; refreshDrafts?: boolean },
  ) => Promise<void>
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
  isExpanded,
  toggleExpand,
} = useBillingDraftGridFilters(draftGridResponse)

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
  return `Cũ ${cell.previousValue}`
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
            v-if="periodEditable"
            variant="secondary"
            size="sm"
            class="mb-0.5"
            @click="bulkEntryOpen = true"
          >
            Nhập nhanh
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
          <span class="text-sm font-semibold tabular-nums text-white">
            {{ displayDraftTotal(row as BillingDraftGridRow) !== null ? formatCurrency(displayDraftTotal(row as BillingDraftGridRow)!) : '—' }}
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

      <!-- Expanded row details -->
      <BillingDraftGridExpandedRow
        v-for="row in filteredRows.filter(r => isExpanded(r))"
        :key="`detail-${row.key}`"
        :row="row"
        :period="period"
        @close="toggleExpand(row)"
        @intent:adjustment="$emit('intent:adjustment', $event)"
        @intent:void-reissue="$emit('intent:void-reissue', $event)"
      />

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

    <BillingDraftGridOverrideModal
      :open="overrideOpen"
      :row="overrideRow"
      :initial-type="overrideType"
      :on-save-override="props.onSaveOverride"
      @close="closeOverrideModal"
    />
    <BillingBulkReadingEntryModal
      :open="bulkEntryOpen"
      :rows="filteredRows"
      @close="bulkEntryOpen = false"
      @apply="applyBulkReadings"
    />
  </div>
</template>
