<script setup lang="ts">
import { computed, ref } from 'vue'
import type { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'
import type { GeneratorError } from '~/utils/rooms/generate-room-numbers'

const props = defineProps<{ preview: ReturnType<typeof useQuickRoomPreview> }>()

// The parent owns this composable instance and passes it in to be driven here;
// mutating its refs is the intended contract (not a plain prop mutation).
const preview = props.preview

const GENERATOR_ERROR_COPY: Record<GeneratorError, string> = {
  floor_range: 'Khoảng tầng không hợp lệ (1–100, từ tầng ≤ đến tầng).',
  rooms_per_floor: 'Tối đa 99 phòng mỗi tầng.',
  seq_overflow: 'Số thứ tự vượt quá 99 khi gắn số tầng. Giảm số phòng hoặc số bắt đầu.',
  too_many: 'Tối đa 200 phòng mỗi lần tạo.',
}

const g = computed({
  get: () => preview.generator.value,
  set: (value) => { preview.generator.value = value },
})
function patch(changes: Partial<typeof g.value>) {
  g.value = { ...g.value, ...changes }
}

const errorCopy = computed(() => {
  const code = preview.generatorError.value
  return code ? GENERATOR_ERROR_COPY[code] : null
})

const flagged = computed(() => new Set([
  ...preview.duplicateRoomNumbers.value,
  ...preview.serverDuplicates.value,
]))

const floorGroups = computed(() => {
  const groups = new Map<number, typeof preview.rows.value>()
  for (const row of preview.rows.value) {
    const list = groups.get(row.floor) ?? []
    list.push(row)
    groups.set(row.floor, list)
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([floor, items]) => ({ floor, items }))
})

const newNumber = ref('')
const newFloor = ref(1)
function addManual() {
  const value = newNumber.value.trim()
  if (!value) return
  preview.addRow(value, Math.max(1, Number(newFloor.value) || 1))
  newNumber.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiInput
        label="Từ tầng" type="number" number-mode="integer"
        :model-value="String(g.floorFrom)"
        @update:model-value="(v: string) => patch({ floorFrom: Number(v) || 1 })"
      />
      <UiInput
        label="Đến tầng" type="number" number-mode="integer"
        :model-value="String(g.floorTo)"
        @update:model-value="(v: string) => patch({ floorTo: Number(v) || 1 })"
      />
      <UiInput
        label="Số phòng mỗi tầng" type="number" number-mode="integer"
        :model-value="String(g.roomsPerFloor)"
        @update:model-value="(v: string) => patch({ roomsPerFloor: Number(v) || 1 })"
      />
      <UiInput
        label="Tiền tố mã phòng" placeholder="Ví dụ: P, A"
        :model-value="g.prefix"
        @update:model-value="(v: string) => patch({ prefix: v })"
      />
      <UiInput
        label="Số thứ tự bắt đầu" type="number" number-mode="integer"
        :model-value="String(g.startSeq)"
        @update:model-value="(v: string) => patch({ startSeq: Number(v) || 0 })"
      />
      <UiInput
        v-if="g.includeFloor"
        label="Số tầng trong tên (tầng đầu)" type="number" number-mode="integer"
        :model-value="String(g.nameFloorStart)"
        @update:model-value="(v: string) => patch({ nameFloorStart: Number(v) || 0 })"
      />
      <UiInput
        label="Giá thuê mặc định (đ)" type="number" number-mode="currency"
        :model-value="String(preview.defaultRent.value)"
        @update:model-value="(v: string) => preview.defaultRent.value = Number(v) || 0"
      />
      <UiInput
        label="Diện tích mặc định (m²)" type="number" number-mode="area" placeholder="Tùy chọn"
        :model-value="preview.defaultArea.value !== null ? String(preview.defaultArea.value) : ''"
        @update:model-value="(v: string) => preview.defaultArea.value = v === '' ? null : Number(v)"
      />
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <UiCheckbox :model-value="g.includeFloor" label="Gắn số tầng vào mã phòng" @update:model-value="(v: boolean) => patch({ includeFloor: v })" />
      <UiCheckbox v-model="preview.samePrice.value" label="Đồng giá cho tất cả phòng" />
    </div>

    <UiAlert v-if="errorCopy" severity="warning">{{ errorCopy }}</UiAlert>
    <UiAlert v-else-if="flagged.size" severity="warning">
      Các mã phòng bị trùng: {{ [...flagged].join(', ') }}. Đổi tiền tố, số bắt đầu hoặc xóa dòng rồi thử lại.
    </UiAlert>

    <div v-if="floorGroups.length" class="space-y-4">
      <p class="text-xs text-ui-muted">Xem trước {{ preview.rows.value.length }} phòng (các phòng đã tồn tại sẽ không được tạo lại):</p>
      <div v-for="group in floorGroups" :key="group.floor" data-test="floor-group" class="rounded-lg border border-ui-border">
        <div class="border-b border-ui-border px-3 py-2 text-xs font-semibold text-ui-accent">Tầng {{ group.floor }}</div>
        <div class="divide-y divide-ui-border">
          <div
            v-for="row in group.items"
            :key="row.roomNumber"
            :data-test="`room-row-${row.roomNumber}`"
            class="flex flex-wrap items-center gap-3 px-3 py-2"
          >
            <span
              class="w-24 font-mono text-sm"
              :class="row.existing ? 'text-ui-muted line-through' : flagged.has(row.roomNumber) ? 'text-ui-danger' : 'text-ui-primary'"
            >{{ row.roomNumber }}</span>
            <UiBadge v-if="row.existing" variant="neutral">Đã có</UiBadge>
            <UiBadge v-else-if="row.manual" variant="accent">Thêm tay</UiBadge>
            <template v-if="!row.existing">
              <UiInput
                class="w-28" density="compact" type="number" number-mode="integer"
                :aria-label="`Tầng ${row.roomNumber}`"
                :model-value="String(row.floor)"
                @update:model-value="(v: string) => preview.setCell(row.roomNumber, 'floor', Math.max(1, Number(v) || 1))"
              />
              <UiInput
                v-if="!preview.samePrice.value"
                class="w-36" density="compact" type="number" number-mode="currency"
                :aria-label="`Giá thuê ${row.roomNumber}`"
                :model-value="String(row.rent)"
                @update:model-value="(v: string) => preview.setCell(row.roomNumber, 'rent', Number(v) || 0)"
              />
              <UiInput
                class="w-28" density="compact" type="number" number-mode="area" placeholder="m²"
                :aria-label="`Diện tích ${row.roomNumber}`"
                :model-value="row.area !== null ? String(row.area) : ''"
                @update:model-value="(v: string) => preview.setCell(row.roomNumber, 'area', v === '' ? null : Number(v))"
              />
            </template>
            <UiButton
              variant="ghost" size="sm" class="ml-auto"
              :aria-label="`Xóa dòng ${row.roomNumber}`"
              @click="preview.removeRow(row.roomNumber)"
            >Xóa</UiButton>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <UiInput v-model="newNumber" label="Thêm phòng thủ công" placeholder="Mã phòng" density="compact" class="w-40" />
        <UiInput
          label="Tầng" type="number" number-mode="integer" density="compact" class="w-24"
          :model-value="String(newFloor)"
          @update:model-value="(v: string) => newFloor = Math.max(1, Number(v) || 1)"
        />
        <UiButton variant="secondary" size="sm" :disabled="!newNumber.trim()" @click="addManual">Thêm dòng</UiButton>
      </div>
    </div>
  </div>
</template>
