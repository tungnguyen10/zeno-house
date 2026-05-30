<script setup lang="ts">
import type { RoomMeterStatus } from '~/types/meter-readings'

import type { MeterReadingCreateInput } from '~/utils/validators/meter-readings'

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
</script>

<template>
  <div>
    <div v-if="roomsStatus.length === 0" class="text-sm text-muted py-4">
      Không có phòng nào đang hoạt động hoặc chưa gắn đồng hồ.
    </div>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-dark-border">
              <th class="text-left text-xs text-muted pb-2 pr-3">Phòng</th>
              <th class="text-left text-xs text-muted pb-2 pr-3">Loại</th>
              <th class="text-right text-xs text-muted pb-2 pr-3">Chỉ số trước</th>
              <th class="text-center text-xs text-muted pb-2 pr-3 w-32">Chỉ số mới</th>
              <th class="text-right text-xs text-muted pb-2 pr-3">Tiêu thụ</th>
              <th class="text-center text-xs text-muted pb-2 pr-3 w-32">Ngày đọc</th>
              <th class="text-left text-xs text-muted pb-2 w-40">Ghi chú</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
            <tr
              v-for="row in rows"
              :key="row.key"
              :class="{ 'bg-yellow-500/5': !row.hasExisting }"
            >
              <td class="py-2 pr-3 text-white font-medium">
                {{ row.roomNumber }}
                <span class="text-muted text-xs"> T{{ row.floor }}</span>
              </td>
              <td class="py-2 pr-3 text-muted">
                {{ meterTypeLabel[row.meterType] ?? row.meterType }}
              </td>
              <td class="py-2 pr-3 text-right text-muted">
                {{ row.previousValue !== null ? row.previousValue.toLocaleString('vi-VN') : '—' }}
              </td>
              <td class="py-2 pr-3">
                <input
                  v-model="row.value"
                  type="number"
                  min="0"
                  step="0.001"
                  :disabled="isSaving"
                  class="w-full rounded border border-dark-border bg-dark-hover px-2 py-1 text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-cyan/50 disabled:opacity-50"
                  placeholder="0"
                >
              </td>
              <td class="py-2 pr-3 text-right">
                <span v-if="consumption(row) !== null" class="text-cyan text-xs">
                  {{ consumption(row)?.toLocaleString('vi-VN') }}
                </span>
                <span v-else class="text-muted text-xs">—</span>
              </td>
              <td class="py-2 pr-3">
                <input
                  v-model="row.readingDate"
                  type="date"
                  :disabled="isSaving"
                  class="w-full rounded border border-dark-border bg-dark-hover px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan/50 disabled:opacity-50"
                >
              </td>
              <td class="py-2">
                <input
                  v-model="row.notes"
                  type="text"
                  :disabled="isSaving"
                  class="w-full rounded border border-dark-border bg-dark-hover px-2 py-1 text-sm text-muted focus:outline-none focus:ring-1 focus:ring-cyan/50 disabled:opacity-50"
                  placeholder="Ghi chú..."
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end mt-4">
        <UiButton :loading="isSaving" @click="onSave">
          Lưu tất cả
        </UiButton>
      </div>
    </template>
  </div>
</template>
