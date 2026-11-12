<script setup lang="ts">
import clsx from 'clsx'
import { computed, ref } from 'vue'
import type { useQuickRoomPreview, PreviewRoom } from '~/composables/buildings/useQuickRoomPreview'
import type { GeneratorError } from '~/utils/rooms/generate-room-numbers'
import { slugifyName } from '~/utils/format/slug'
import { QUICK_ROOM_MAX } from '~/utils/validators/buildings'

const props = withDefaults(defineProps<{
  preview: ReturnType<typeof useQuickRoomPreview>
  disabled?: boolean
}>(), {
  disabled: false,
})

const GENERATOR_ERRORS: Record<GeneratorError, string> = {
  floor_range: 'Khoảng tầng không hợp lệ (1–100, từ tầng ≤ đến tầng).',
  rooms_per_floor: 'Tối đa 99 phòng mỗi tầng.',
  seq_overflow: 'Số thứ tự vượt quá 99 khi gắn số tầng. Giảm số phòng hoặc số bắt đầu.',
  too_many: `Tối đa ${QUICK_ROOM_MAX} phòng mỗi lần tạo.`,
  invalid_input: 'Cấu hình sinh mã phòng không hợp lệ. Kiểm tra tiền tố (tối đa 10 ký tự) và các số bắt đầu.',
}

const { generator, defaultRent, defaultArea, samePrice } = props.preview
const roomKey = (roomNumber: string) => slugifyName(roomNumber) || roomNumber.toLowerCase()

const generatorMessage = computed(() => {
  const error = props.preview.generatorError.value
  return error ? GENERATOR_ERRORS[error] : null
})

const flagged = computed(() => new Set([
  ...props.preview.duplicateRoomNumbers.value,
  ...props.preview.serverDuplicates.value,
].map(roomKey)))

const groups = computed(() => {
  const byFloor = new Map<number, PreviewRoom[]>()
  for (const row of props.preview.rows.value) {
    const list = byFloor.get(row.floor) ?? []
    list.push(row)
    byFloor.set(row.floor, list)
  }
  return [...byFloor.entries()].sort(([a], [b]) => a - b).map(([floor, rows]) => ({ floor, rows }))
})

const newNumber = ref('')
const newFloor = ref(1)
const addError = ref<string | null>(null)

function addManual() {
  const ok = props.preview.addRow(newNumber.value.trim(), newFloor.value)
  addError.value = ok ? null : 'Không thể thêm phòng: mã phòng trống, đã tồn tại trong danh sách hoặc đã đạt giới hạn.'
  if (ok) newNumber.value = ''
}

const toInt = (raw: string, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(Number(raw)) || min))
const toNonNegative = (raw: string) => Math.max(0, Math.trunc(Number(raw)) || 0)
</script>

<template>
  <div class="min-w-0 space-y-5">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <UiInput
        label="Từ tầng"
        type="number"
        number-mode="integer"
        min="1"
        max="100"
        :disabled="disabled"
        :model-value="String(generator.floorFrom)"
        @update:model-value="(v: string) => generator.floorFrom = toInt(v, 1, 100)"
      />
      <UiInput
        label="Đến tầng"
        type="number"
        number-mode="integer"
        min="1"
        max="100"
        :disabled="disabled"
        :model-value="String(generator.floorTo)"
        @update:model-value="(v: string) => generator.floorTo = toInt(v, 1, 100)"
      />
      <UiInput
        label="Phòng mỗi tầng"
        type="number"
        number-mode="integer"
        min="1"
        max="99"
        :disabled="disabled"
        :model-value="String(generator.roomsPerFloor)"
        @update:model-value="(v: string) => generator.roomsPerFloor = toInt(v, 1, 99)"
      />
      <UiInput
        v-model="generator.prefix"
        label="Tiền tố mã phòng"
        placeholder="Ví dụ: P, A"
        :disabled="disabled"
      />
      <UiInput
        :label="generator.includeFloor ? 'Số thứ tự đầu mỗi tầng' : 'Số bắt đầu'"
        type="number"
        number-mode="integer"
        min="0"
        :disabled="disabled"
        :model-value="String(generator.startSeq)"
        @update:model-value="(v: string) => generator.startSeq = toNonNegative(v)"
      />
      <UiInput
        v-if="generator.includeFloor"
        label="Số tầng bắt đầu trong mã"
        type="number"
        number-mode="integer"
        min="0"
        :disabled="disabled"
        :model-value="String(generator.nameFloorStart)"
        @update:model-value="(v: string) => generator.nameFloorStart = toNonNegative(v)"
      />
      <UiInput
        label="Giá thuê mặc định (đ)"
        type="number"
        number-mode="currency"
        :disabled="disabled"
        :model-value="String(defaultRent)"
        @update:model-value="(v: string) => defaultRent = Number(v) || 0"
      />
      <UiInput
        label="Diện tích mặc định (m²)"
        type="number"
        number-mode="area"
        min="0"
        placeholder="Tùy chọn"
        :disabled="disabled"
        :model-value="defaultArea !== null ? String(defaultArea) : ''"
        @update:model-value="(v: string) => defaultArea = v === '' ? null : Number(v)"
      />
    </div>

    <div class="flex flex-wrap gap-x-6 gap-y-2">
      <UiCheckbox v-model="generator.includeFloor" label="Gắn số tầng vào mã phòng (P101, P201…)" :disabled="disabled" />
      <UiCheckbox v-model="samePrice" label="Đồng giá cho tất cả phòng" :disabled="disabled" />
    </div>

    <UiAlert v-if="generatorMessage" severity="danger" data-test="generator-error">
      {{ generatorMessage }}
    </UiAlert>
    <UiAlert v-if="flagged.size" severity="warning" class="break-words">
      Các mã phòng bị trùng: {{ [...preview.duplicateRoomNumbers.value, ...preview.serverDuplicates.value].join(', ') }}. Đổi tiền tố hoặc số bắt đầu rồi thử lại.
    </UiAlert>

    <div v-if="groups.length" class="min-w-0 space-y-4" role="region" aria-label="Xem trước phòng">
      <p class="text-xs text-ui-muted">
        Xem trước {{ preview.rows.value.length }} phòng. Ô đã sửa giữ giá trị khi đổi mặc định; bật đồng giá sẽ đặt lại giá thuê của tất cả phòng.
      </p>
      <section v-for="group in groups" :key="group.floor" data-test="floor-group" class="overflow-hidden rounded-xl border border-ui-border">
        <h4 class="bg-ui-chrome px-3 py-2 text-xs font-medium uppercase tracking-wide text-ui-muted">
          Tầng {{ group.floor }} · {{ group.rows.length }} phòng
        </h4>
        <ul class="divide-y divide-ui-border">
          <li
            v-for="row in group.rows"
            :key="row.roomNumber"
            :data-test="`room-row-${row.roomNumber}`"
            :class="clsx('grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-3 py-2 md:grid-cols-[7rem_5rem_minmax(0,1fr)_7rem_2.25rem]', row.existing && 'opacity-60')"
          >
            <div class="min-w-0 pt-1.5">
              <span :class="clsx('break-all font-mono text-sm', flagged.has(roomKey(row.roomNumber)) ? 'text-status-danger' : 'text-ui-primary')">
                {{ row.roomNumber }}
              </span>
              <UiBadge v-if="row.existing" class="ml-2">Đã có</UiBadge>
              <span v-else-if="flagged.has(roomKey(row.roomNumber))" class="block text-xs text-status-danger">Mã trùng</span>
            </div>
            <div class="order-last col-span-2 grid grid-cols-3 gap-2 md:order-none md:col-span-3">
              <div class="col-span-3 grid grid-cols-3 gap-2 text-[11px] text-ui-muted md:hidden" aria-hidden="true">
                <span>Tầng</span>
                <span>Giá thuê</span>
                <span>m²</span>
              </div>
              <QuickRoomCellEditor
                compact
                :room-number="row.roomNumber"
                field="floor"
                :value="row.floor"
                :overridden="row.overridden.includes('floor')"
                :disabled="disabled || row.existing"
                @update="(v) => preview.setCell(row.roomNumber, 'floor', v ?? 1)"
                @reset="preview.resetCell(row.roomNumber, 'floor')"
              />
              <QuickRoomCellEditor
                v-if="!samePrice"
                compact
                :room-number="row.roomNumber"
                field="rent"
                :value="row.rent"
                :overridden="row.overridden.includes('rent')"
                :disabled="disabled || row.existing"
                @update="(v) => preview.setCell(row.roomNumber, 'rent', v ?? 0)"
                @reset="preview.resetCell(row.roomNumber, 'rent')"
              />
              <span v-else class="pt-1.5 text-sm tabular-nums text-ui-primary">{{ row.rent.toLocaleString('vi-VN') }} đ</span>
              <QuickRoomCellEditor
                compact
                :room-number="row.roomNumber"
                field="area"
                :value="row.area"
                :overridden="row.overridden.includes('area')"
                :disabled="disabled || row.existing"
                @update="(v) => preview.setCell(row.roomNumber, 'area', v)"
                @reset="preview.resetCell(row.roomNumber, 'area')"
              />
            </div>
            <UiButton
              variant="ghost"
              size="sm"
              icon-only
              :disabled="disabled"
              :aria-label="`Bỏ phòng ${row.roomNumber}`"
              class="md:col-start-5 md:row-start-1"
              @click="preview.removeRow(row.roomNumber)"
            >
              <IconX class="size-4" aria-hidden="true" />
            </UiButton>
          </li>
        </ul>
      </section>

      <form class="flex flex-wrap items-end gap-3" @submit.prevent="addManual">
        <UiInput v-model="newNumber" label="Thêm phòng lẻ" placeholder="Mã phòng" :disabled="disabled" class="w-40" />
        <UiInput
          label="Tầng"
          type="number"
          number-mode="integer"
          min="1"
          max="100"
          :disabled="disabled"
          class="w-24"
          :model-value="String(newFloor)"
          @update:model-value="(v: string) => newFloor = toInt(v, 1, 100)"
        />
        <UiButton type="submit" variant="secondary" size="md" :disabled="disabled || !newNumber.trim()">
          <IconPlus class="size-4" aria-hidden="true" />
          Thêm
        </UiButton>
      </form>
      <p v-if="addError" class="text-xs text-status-danger">{{ addError }}</p>
    </div>
  </div>
</template>
