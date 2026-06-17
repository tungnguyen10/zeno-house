<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import clsx from 'clsx'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftGridRow } from '~/types/billing'
import {
  acceptedBulkReadingUpdates,
  buildBulkReadingPreview,
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

const preview = computed(() => buildBulkReadingPreview(raw.value, props.rows, { mode: mode.value }))
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

watch(() => props.open, (open) => {
  if (open) {
    raw.value = ''
    mode.value = 'auto'
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

function statusClass(line: BulkReadingPreviewLine): string {
  return clsx(
    'text-xs',
    line.status === 'error' && 'text-rose-400',
    line.status === 'warning' && 'text-amber-300',
    line.status === 'accepted' && 'text-emerald-300',
    line.status === 'skipped' && 'text-muted',
  )
}
</script>

<template>
  <UiModal
    :open="open"
    title="Nhập nhanh chỉ số"
    size="xl"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <UiAlert severity="info">
        <p class="text-sm text-white">{{ guidance.title }}</p>
        <div v-if="guidance.examples.length > 0" class="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-3">
          <code
            v-for="example in guidance.examples"
            :key="example"
            class="rounded border border-dark-border bg-dark-surface px-2 py-1 text-white"
          >
            {{ example }}
          </code>
        </div>
        <p class="mt-2 text-xs text-muted">{{ guidance.note }}</p>
      </UiAlert>

      <div class="flex flex-wrap items-center gap-2">
        <UiButton size="sm" :variant="mode === 'auto' ? 'primary' : 'ghost'" @click="mode = 'auto'">
          Tự nhận
        </UiButton>
        <UiButton size="sm" :variant="mode === 'room' ? 'primary' : 'ghost'" @click="mode = 'room'">
          Theo tên phòng
        </UiButton>
        <UiButton size="sm" :variant="mode === 'ordered' ? 'primary' : 'ghost'" @click="mode = 'ordered'">
          Theo thứ tự
        </UiButton>
        <span class="text-xs text-muted">
          Đang đọc: {{ preview.mode === 'room' ? 'theo tên phòng' : 'theo thứ tự đang hiển thị' }}
        </span>
      </div>

      <UiTextarea
        v-model="raw"
        label="Danh sách chỉ số"
        :rows="8"
        resize="vertical"
        placeholder="A101 12345 12&#10;A102&#10;A103 - 15"
      />

      <UiAlert v-if="preview.ambiguous" severity="warning">
        Input có thể bị nhầm giữa tên phòng và chỉ số. Kiểm tra preview hoặc chọn chế độ đọc trước khi áp dụng.
      </UiAlert>

      <div class="grid gap-2 text-xs text-muted sm:grid-cols-3">
        <span>Áp dụng: <strong class="text-white">{{ preview.applyCount }}</strong></span>
        <span>Cảnh báo: <strong class="text-amber-300">{{ preview.warningCount }}</strong></span>
        <span>Lỗi: <strong class="text-rose-400">{{ preview.blockingCount }}</strong></span>
      </div>

      <UiTable
        v-if="preview.lines.length > 0"
        :columns="columns"
        :rows="preview.lines"
        row-key="lineNumber"
        density="dense"
      >
        <template #cell-line="{ row }">
          {{ (row as BulkReadingPreviewLine).lineNumber }}
        </template>
        <template #cell-room="{ row }">
          {{ (row as BulkReadingPreviewLine).roomNumber ?? (row as BulkReadingPreviewLine).roomToken ?? '—' }}
        </template>
        <template #cell-electricity="{ row }">
          <span :title="cellTitle(row as BulkReadingPreviewLine, 'electricity')">
            {{ cellText(row as BulkReadingPreviewLine, 'electricity') }}
          </span>
        </template>
        <template #cell-water="{ row }">
          <span :title="cellTitle(row as BulkReadingPreviewLine, 'water')">
            {{ cellText(row as BulkReadingPreviewLine, 'water') }}
          </span>
        </template>
        <template #cell-status="{ row }">
          <span :class="statusClass(row as BulkReadingPreviewLine)">
            {{ (row as BulkReadingPreviewLine).message }}
          </span>
        </template>
      </UiTable>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Hủy</UiButton>
      <UiButton :disabled="!canApply" @click="apply">
        Áp dụng {{ updates.length }} chỉ số
      </UiButton>
    </template>
  </UiModal>
</template>
