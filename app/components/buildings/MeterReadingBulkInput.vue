<script setup lang="ts">
import type { RoomMeterStatus } from '~/types/meter-readings'
import type { MeterReadingCreateInput } from '~/utils/validators/meter-readings'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

const props = defineProps<{
  roomsStatus: RoomMeterStatus[]
  periodYear: number
  periodMonth: number
  isSaving?: boolean
}>()

const emit = defineEmits<{
  save: [readings: MeterReadingCreateInput[]]
}>()

interface FlatRow {
  key: string
  roomId: string
  roomNumber: string
  floor: number
  meterType: 'electricity' | 'water'
  previousValue: number | null
  hasExisting: boolean
  value: string
  readingDate: string
  notes: string
}

const today = new Date().toISOString().slice(0, 10)

const rows = ref<FlatRow[]>([])

watchEffect(() => {
  rows.value = props.roomsStatus.flatMap(room =>
    room.devices.map(d => ({
      key: `${room.roomId}-${d.meterType}`,
      roomId: room.roomId,
      roomNumber: room.roomNumber,
      floor: room.floor,
      meterType: d.meterType,
      previousValue: d.previousReading?.readingValue ?? null,
      hasExisting: d.existingReading !== null,
      value: d.existingReading ? String(d.existingReading.readingValue) : '',
      readingDate: d.existingReading?.readingDate ?? today,
      notes: d.existingReading?.notes ?? '',
    })),
  )
})

function consumption(row: FlatRow): number | null {
  if (row.previousValue === null) return null
  const val = parseFloat(row.value)
  if (isNaN(val)) return null
  return Math.max(0, val - row.previousValue)
}

function onSave() {
  const readings = rows.value
    .filter(row => row.value !== '')
    .map(row => ({
      room_id: row.roomId,
      meter_type: row.meterType,
      period_year: props.periodYear,
      period_month: props.periodMonth,
      reading_type: 'monthly' as const,
      reading_date: row.readingDate,
      reading_value: parseFloat(row.value),
      notes: row.notes || null,
    }))
    .filter(r => !isNaN(r.reading_value))

  emit('save', readings)
}

const meterTypeLabel: Record<string, string> = {
  electricity: 'Điện',
  water: 'Nước',
}

const columns: UiTableColumn<FlatRow>[] = [
  { key: 'roomNumber', label: 'Phòng' },
  { key: 'meterType', label: 'Loại' },
  { key: 'previousValue', label: 'Chỉ số trước', numeric: true },
  { key: 'value', label: 'Chỉ số mới', numeric: true, width: 'w-36' },
  { key: 'consumption', label: 'Tiêu thụ', numeric: true },
  { key: 'readingDate', label: 'Ngày đọc', width: 'w-36' },
  { key: 'notes', label: 'Ghi chú' },
]
</script>

<template>
  <div>
    <UiTable
      :rows="rows"
      :columns="columns"
      row-key="key"
      :loading="isSaving"
      empty-title="Không có phòng nào đang hoạt động hoặc chưa gắn đồng hồ"
    >
      <template #cell-roomNumber="{ row }">
        <span class="font-medium text-white">{{ row.roomNumber }}</span>
        <span class="text-muted text-xs ml-1"> T{{ row.floor }}</span>
      </template>

      <template #cell-meterType="{ row }">
        {{ meterTypeLabel[row.meterType] ?? row.meterType }}
      </template>

      <template #cell-previousValue="{ row }">
        {{ row.previousValue !== null ? row.previousValue.toLocaleString('vi-VN') : '—' }}
      </template>

      <template #cell-value="{ row }">
        <UiInput
          density="compact"
          type="number"
          :model-value="row.value"
          :disabled="isSaving"
          placeholder="0"
          @update:model-value="(v) => row.value = String(v)"
        />
      </template>

      <template #cell-consumption="{ row }">
        <span v-if="consumption(row) !== null" class="text-cyan text-xs">
          {{ consumption(row)?.toLocaleString('vi-VN') }}
        </span>
        <span v-else class="text-muted text-xs">—</span>
      </template>

      <template #cell-readingDate="{ row }">
        <UiInput
          density="compact"
          type="date"
          :model-value="row.readingDate"
          :disabled="isSaving"
          @update:model-value="(v) => row.readingDate = String(v)"
        />
      </template>

      <template #cell-notes="{ row }">
        <UiInput
          density="compact"
          type="text"
          :model-value="row.notes"
          :disabled="isSaving"
          placeholder="Ghi chú..."
          @update:model-value="(v) => row.notes = String(v)"
        />
      </template>
    </UiTable>

    <div v-if="rows.length > 0" class="flex justify-end mt-4">
      <UiButton :loading="isSaving" @click="onSave">
        Lưu tất cả
      </UiButton>
    </div>
  </div>
</template>
