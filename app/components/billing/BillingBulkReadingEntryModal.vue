<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import clsx from 'clsx'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftGridRow } from '~/types/billing'
import {
  acceptedBulkReadingUpdates,
  buildBulkReadingPreview,
  DEFAULT_USAGE_WARNING_PERCENT,
  type BulkReadingMode,
  type BulkReadingPreviewLine,
  type MeterType,
} from '~/utils/billing/bulk-readings'

const props = defineProps<{
  open: boolean
  rows: BillingDraftGridRow[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', updates: Array<{ row: BillingDraftGridRow; type: MeterType; value: string }>): void
}>()

const raw = ref('')
const mode = ref<BulkReadingMode>('auto')
const usageWarningPercent = ref(DEFAULT_USAGE_WARNING_PERCENT)

const modeOptions: Array<{ value: BulkReadingMode, label: string }> = [
  { value: 'auto', label: 'Tự nhận' },
  { value: 'room', label: 'Theo tên phòng' },
  { value: 'ordered', label: 'Theo thứ tự' },
]

// UiFilterChips is multi-select; keep single-select by only accepting the newly toggled-on value.
function onModeChipChange(next: BulkReadingMode[]) {
  const picked = next.find(value => value !== mode.value)
  if (picked) mode.value = picked
}

const preview = computed(() => buildBulkReadingPreview(raw.value, props.rows, {
  mode: mode.value,
  usageWarningPercent: usageWarningPercent.value,
}))
const updates = computed(() => acceptedBulkReadingUpdates(preview.value))
const canApply = computed(() => updates.value.length > 0 && preview.value.blockingCount === 0)

const columns: UiTableColumn<BulkReadingPreviewLine>[] = [
  { key: 'line', label: 'Dòng', width: 'w-16' },
  { key: 'room', label: 'Phòng', width: 'w-24' },
  { key: 'electricity', label: 'Điện', numeric: true, width: 'w-28' },
  { key: 'water', label: 'Nước', numeric: true, width: 'w-28' },
  { key: 'status', label: 'Trạng thái' },
]

const guidance = computed(() => {
  const rows = props.rows.filter(row => row.editable)
  const needsElectricity = rows.some(row => row.electricity?.editable)
  const needsWater = rows.some(row => row.water?.editable)
  const hasMixed = needsElectricity && needsWater
    && rows.some(row => row.electricity?.editable && !row.water?.editable)

  if (hasMixed) {
    return {
      title: 'Các phòng có yêu cầu nhập chỉ số khác nhau.',
      examples: ['A101 12345 12', 'A102 45678', '12345'],
      note: 'Mỗi phòng chỉ cần nhập chỉ số áp dụng cho phòng đó. Cột không áp dụng sẽ được đánh dấu trong preview.',
    }
  }
  if (needsElectricity && needsWater) {
    return {
      title: 'Nhập theo phòng hoặc theo thứ tự đang hiển thị.',
      examples: ['A101 12345 12', 'A102 - 15', '12345 12'],
      note: 'Mỗi dòng là một phòng. Dòng trống hoặc dấu - sẽ bỏ qua chỉ số tương ứng.',
    }
  }
  if (needsElectricity) {
    return {
      title: 'Tòa này chỉ cần nhập số điện.',
      examples: ['A101 12345', 'A102 45678', '12345'],
      note: 'Nước đang tính theo đầu người/cố định hoặc không cần nhập; nếu có cột nước, hệ thống sẽ bỏ qua.',
    }
  }
  if (needsWater) {
    return {
      title: 'Tòa này chỉ cần nhập số nước theo đồng hồ.',
      examples: ['A101 12', 'A102 18', '12'],
      note: 'Điện không cần nhập cho các dòng đang hiển thị.',
    }
  }
  return {
    title: 'Không có dòng chỉ số có thể nhập nhanh.',
    examples: [],
    note: 'Kiểm tra bộ lọc hoặc trạng thái kỳ trước khi nhập.',
  }
})

// Each guidance branch lists room-prefixed examples first, then one bare/ordered
// example last — narrow the list to what the active mode actually accepts.
const visibleExamples = computed(() => {
  const examples = guidance.value.examples
  if (mode.value === 'room') return examples.slice(0, -1)
  if (mode.value === 'ordered') return examples.slice(-1)
  return examples
})

watch(() => props.open, (open) => {
  if (open) {
    raw.value = ''
    mode.value = 'auto'
    usageWarningPercent.value = DEFAULT_USAGE_WARNING_PERCENT
  }
})

function apply() {
  if (!canApply.value) return
  emit('apply', updates.value)
  emit('close')
}

function cellText(line: BulkReadingPreviewLine, type: MeterType): string {
  const cell = line.cells[type]
  return cell.value ?? cell.raw ?? '—'
}

function cellTitle(line: BulkReadingPreviewLine, type: MeterType): string {
  return line.cells[type].message
}

function cellClass(line: BulkReadingPreviewLine, type: MeterType): string {
  const cell = line.cells[type]
  const rejected = cell.status === 'below_previous'
  const warningLike = cell.status === 'warning' || cell.status === 'usage_spike' || cell.status === 'usage_drop' || cell.status === 'zero_usage'
  return clsx(
    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums',
    (cell.blocking || rejected) && 'bg-status-danger/10 font-semibold text-status-danger ring-1 ring-status-danger/30',
    !cell.blocking && !rejected && warningLike && 'bg-status-warning/10 font-semibold text-status-warning ring-1 ring-status-warning/30',
  )
}

function cellHasIssue(line: BulkReadingPreviewLine, type: MeterType): boolean {
  const cell = line.cells[type]
  return cell.blocking
    || cell.status === 'below_previous'
    || cell.status === 'warning'
    || cell.status === 'usage_spike'
    || cell.status === 'usage_drop'
    || cell.status === 'zero_usage'
}

function cellPreviousText(line: BulkReadingPreviewLine, type: MeterType): string | null {
  const previous = line.row?.[type]?.previousValue
  if (previous === null || previous === undefined) return null
  return `Cũ: ${previous.toLocaleString('vi-VN')}`
}

function statusClass(line: BulkReadingPreviewLine): string {
  return clsx(
    'text-xs',
    line.status === 'error' && 'text-status-danger',
    line.status === 'rejected' && 'text-status-danger',
    line.status === 'warning' && 'text-status-warning',
    line.status === 'accepted' && 'text-status-success',
    line.status === 'skipped' && 'text-ui-muted',
  )
}
</script>

<template>
  <UiModal
    :open="open"
    title="Nhập nhanh chỉ số"
    size="xl"
    mobile-fullscreen
    @close="emit('close')"
  >
    <div class="space-y-3 sm:space-y-4">
      <UiAlert severity="info">
        <p class="text-sm text-ui-primary">{{ guidance.title }}</p>
        <div
          v-if="visibleExamples.length > 0"
          class="mt-1.5 flex gap-1.5 overflow-x-auto no-scrollbar text-xs text-ui-muted sm:grid sm:grid-cols-3 sm:gap-1 sm:overflow-visible"
        >
          <code
            v-for="example in visibleExamples"
            :key="example"
            class="shrink-0 rounded border border-ui-border bg-ui-surface px-2 py-1 text-ui-primary sm:shrink"
          >
            {{ example }}
          </code>
        </div>
        <p class="mt-1.5 text-xs text-ui-muted">{{ guidance.note }}</p>
      </UiAlert>

      <div class="space-y-2">
        <UiFilterChips
          :model-value="[mode]"
          :options="modeOptions"
          aria-label="Chế độ đọc chỉ số"
          @update:model-value="onModeChipChange"
        />
        <div class="flex flex-col gap-1.5 text-xs text-ui-muted sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <label
            class="flex items-center gap-1.5"
            title="Áp dụng khi tiêu thụ kỳ này tăng hoặc giảm quá ngưỡng so với kỳ trước"
          >
            Cảnh báo lệch tiêu thụ hơn
            <UiInput
              v-model.number="usageWarningPercent"
              type="number"
              number-mode="integer"
              min="1"
              max="200"
              step="1"
              density="compact"
              class="w-16"
              aria-label="Ngưỡng cảnh báo lệch tiêu thụ (%)"
            >
              <template #suffix>%</template>
            </UiInput>
          </label>
          <span>Đang đọc: {{ preview.mode === 'room' ? 'theo tên phòng' : 'theo thứ tự đang hiển thị' }}</span>
        </div>
      </div>

      <UiTextarea
        v-model="raw"
        label="Danh sách chỉ số"
        :rows="8"
        resize="vertical"
        autofocus
        placeholder="A101 12345 12&#10;A102&#10;A103 - 15"
      />

      <UiAlert v-if="preview.ambiguous" severity="warning">
        Input có thể bị nhầm giữa tên phòng và chỉ số. Kiểm tra preview hoặc chọn chế độ đọc trước khi áp dụng.
      </UiAlert>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ui-muted sm:grid-cols-4">
        <span>Áp dụng: <strong class="text-ui-primary">{{ preview.applyCount }}</strong></span>
        <span>Cảnh báo: <strong class="text-status-warning">{{ preview.warningCount }}</strong></span>
        <span>Bị loại: <strong class="text-status-danger">{{ preview.rejectedCount }}</strong></span>
        <span>Lỗi: <strong class="text-status-danger">{{ preview.blockingCount }}</strong></span>
      </div>

      <template v-if="preview.lines.length > 0">
        <!-- Mobile: card list, same convention as the invoice review list -->
        <div class="divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border bg-ui-surface md:hidden">
          <div v-for="line in preview.lines" :key="line.lineNumber" class="flex flex-col gap-2 p-3">
            <p class="truncate text-sm font-medium text-ui-primary">
              Dòng {{ line.lineNumber }} · {{ line.roomNumber ?? line.roomToken ?? '—' }}
            </p>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div class="min-w-0">
                <span class="text-ui-muted">Điện </span>
                <span :class="cellClass(line, 'electricity')" :title="cellTitle(line, 'electricity')">
                  {{ cellText(line, 'electricity') }}
                </span>
                <span v-if="cellHasIssue(line, 'electricity') && cellPreviousText(line, 'electricity')" class="block text-[11px] tabular-nums text-ui-muted">
                  {{ cellPreviousText(line, 'electricity') }}
                </span>
              </div>
              <div class="min-w-0 text-right">
                <span class="text-ui-muted">Nước </span>
                <span :class="cellClass(line, 'water')" :title="cellTitle(line, 'water')">
                  {{ cellText(line, 'water') }}
                </span>
                <span v-if="cellHasIssue(line, 'water') && cellPreviousText(line, 'water')" class="block text-[11px] tabular-nums text-ui-muted">
                  {{ cellPreviousText(line, 'water') }}
                </span>
              </div>
            </div>
            <p :class="statusClass(line)">{{ line.message }}</p>
          </div>
        </div>

        <!-- Desktop: dense table -->
        <UiTable
          :columns="columns"
          :rows="preview.lines"
          row-key="lineNumber"
          density="dense"
          class="hidden md:block"
        >
          <template #cell-line="{ row }">
            {{ (row as BulkReadingPreviewLine).lineNumber }}
          </template>
          <template #cell-room="{ row }">
            {{ (row as BulkReadingPreviewLine).roomNumber ?? (row as BulkReadingPreviewLine).roomToken ?? '—' }}
          </template>
          <template #cell-electricity="{ row }">
            <span class="inline-flex flex-col items-end gap-0.5">
              <span
                :class="cellClass(row as BulkReadingPreviewLine, 'electricity')"
                :title="cellTitle(row as BulkReadingPreviewLine, 'electricity')"
              >
                {{ cellText(row as BulkReadingPreviewLine, 'electricity') }}
              </span>
              <span
                v-if="cellHasIssue(row as BulkReadingPreviewLine, 'electricity') && cellPreviousText(row as BulkReadingPreviewLine, 'electricity')"
                class="text-[11px] tabular-nums text-ui-muted"
              >
                {{ cellPreviousText(row as BulkReadingPreviewLine, 'electricity') }}
              </span>
            </span>
          </template>
          <template #cell-water="{ row }">
            <span class="inline-flex flex-col items-end gap-0.5">
              <span
                :class="cellClass(row as BulkReadingPreviewLine, 'water')"
                :title="cellTitle(row as BulkReadingPreviewLine, 'water')"
              >
                {{ cellText(row as BulkReadingPreviewLine, 'water') }}
              </span>
              <span
                v-if="cellHasIssue(row as BulkReadingPreviewLine, 'water') && cellPreviousText(row as BulkReadingPreviewLine, 'water')"
                class="text-[11px] tabular-nums text-ui-muted"
              >
                {{ cellPreviousText(row as BulkReadingPreviewLine, 'water') }}
              </span>
            </span>
          </template>
          <template #cell-status="{ row }">
            <span :class="statusClass(row as BulkReadingPreviewLine)">
              {{ (row as BulkReadingPreviewLine).message }}
            </span>
          </template>
        </UiTable>
      </template>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Hủy</UiButton>
      <UiButton :disabled="!canApply" @click="apply">
        Áp dụng {{ updates.length }} chỉ số
      </UiButton>
    </template>
  </UiModal>
</template>
