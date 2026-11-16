<script setup lang="ts">
import { computed } from 'vue'
import { contractVehicleListSchema, normalizePlate } from '~/utils/validators/contract-vehicles'

export interface VehicleRow {
  owner_name: string
  plate_number: string
  vehicle_type: string | null
  note: string | null
}

const props = withDefaults(defineProps<{
  modelValue: VehicleRow[]
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ 'update:modelValue': [rows: VehicleRow[]] }>()

// Surface per-row plate errors (duplicate / too long) straight from the shared schema.
const plateErrors = computed<Record<number, string>>(() => {
  const result = contractVehicleListSchema.safeParse(props.modelValue)
  if (result.success) return {}
  const map: Record<number, string> = {}
  for (const issue of result.error.issues) {
    const idx = issue.path[0]
    if (typeof idx === 'number' && issue.path[1] === 'plate_number') map[idx] = issue.message
  }
  return map
})

function update(index: number, patch: Partial<VehicleRow>) {
  emit('update:modelValue', props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}

function onPlateBlur(index: number) {
  const current = props.modelValue[index]
  if (!current) return
  const normalized = normalizePlate(current.plate_number)
  if (normalized !== current.plate_number) update(index, { plate_number: normalized })
}

function addRow() {
  emit('update:modelValue', [...props.modelValue, { owner_name: '', plate_number: '', vehicle_type: null, note: null }])
}

function removeRow(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="modelValue.length === 0" class="text-sm text-ui-muted">
      Chưa có xe nào. Bấm "Thêm xe" để khai báo.
    </p>

    <div
      v-for="(row, index) in modelValue"
      :key="index"
      class="rounded-lg border border-ui-border bg-ui-surface p-3"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div class="sm:col-span-3">
          <UiInput
            :model-value="row.owner_name"
            label="Chủ xe"
            density="compact"
            :disabled="disabled"
            :aria-label="`Chủ xe ${index + 1}`"
            @update:model-value="(v: string) => update(index, { owner_name: v })"
          />
        </div>
        <div class="sm:col-span-3">
          <UiInput
            :model-value="row.plate_number"
            label="Biển số"
            density="compact"
            :disabled="disabled"
            :aria-label="`Biển số ${index + 1}`"
            @update:model-value="(v: string) => update(index, { plate_number: v })"
            @blur="onPlateBlur(index)"
          />
          <p v-if="plateErrors[index]" class="mt-1 text-xs text-ui-danger">{{ plateErrors[index] }}</p>
        </div>
        <div class="sm:col-span-2">
          <UiInput
            :model-value="row.vehicle_type ?? ''"
            label="Loại xe"
            density="compact"
            placeholder="Tùy chọn"
            :disabled="disabled"
            :aria-label="`Loại xe ${index + 1}`"
            @update:model-value="(v: string) => update(index, { vehicle_type: v.trim() === '' ? null : v })"
          />
        </div>
        <div class="flex items-end gap-2 sm:col-span-4">
          <UiInput
            :model-value="row.note ?? ''"
            label="Ghi chú"
            density="compact"
            :disabled="disabled"
            :aria-label="`Ghi chú xe ${index + 1}`"
            @update:model-value="(v: string) => update(index, { note: v.trim() === '' ? null : v })"
          />
          <UiButton
            v-if="!disabled"
            variant="ghost"
            size="sm"
            :data-test="`vehicle-remove-${index}`"
            :aria-label="`Xóa xe ${index + 1}`"
            @click="removeRow(index)"
          >
            Xóa
          </UiButton>
        </div>
      </div>
    </div>

    <UiButton v-if="!disabled" variant="secondary" size="sm" data-test="vehicle-add" @click="addRow">
      Thêm xe
    </UiButton>
  </div>
</template>
