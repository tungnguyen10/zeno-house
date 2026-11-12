<script setup lang="ts">
import { computed } from 'vue'
import type { InventoryItemInput } from '~/utils/validators/inventory'
import { INVENTORY_CONDITION_LABELS } from '~/types/inventory'
import { formatCurrency } from '~/utils/format/currency'

const props = withDefaults(defineProps<{
  modelValue: InventoryItemInput[]
  disabled?: boolean
  errors?: Record<string, string>
}>(), {
  disabled: false,
  errors: () => ({}),
})

const emit = defineEmits<{ 'update:modelValue': [items: InventoryItemInput[]] }>()

const conditionOptions = Object.entries(INVENTORY_CONDITION_LABELS).map(([value, label]) => ({ value, label }))

const total = computed(() => props.modelValue.reduce((sum, item) => sum + item.quantity * (item.unit_value ?? 0), 0))

function update(index: number, patch: Partial<InventoryItemInput>) {
  emit('update:modelValue', props.modelValue.map((item, i) => (i === index ? { ...item, ...patch } : item)))
}

function addRow() {
  emit('update:modelValue', [
    ...props.modelValue,
    { name: '', quantity: 1, condition: 'good', unit_value: null, note: null },
  ])
}

function removeRow(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="modelValue.length === 0" class="text-sm text-ui-muted">
      Chưa có món nội thất nào. Bấm "Thêm món" để khai báo.
    </p>

    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="rounded-lg border border-ui-border bg-ui-surface p-3"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div class="sm:col-span-4">
          <UiInput
            :model-value="item.name"
            label="Tên"
            density="compact"
            :disabled="disabled"
            :aria-label="`Tên món ${index + 1}`"
            @update:model-value="(v: string) => update(index, { name: v })"
          />
          <p v-if="errors[`${index}.name`]" class="mt-1 text-xs text-ui-danger">{{ errors[`${index}.name`] }}</p>
        </div>
        <div class="sm:col-span-2">
          <UiInput
            :model-value="String(item.quantity)"
            label="Số lượng"
            type="number"
            number-mode="integer"
            density="compact"
            :disabled="disabled"
            :aria-label="`Số lượng món ${index + 1}`"
            @update:model-value="(v: string) => update(index, { quantity: Math.max(1, Number(v) || 1) })"
          />
        </div>
        <div class="sm:col-span-2">
          <UiSelect
            :model-value="item.condition"
            label="Tình trạng"
            :options="conditionOptions"
            :disabled="disabled"
            @update:model-value="(v) => update(index, { condition: v as InventoryItemInput['condition'] })"
          />
        </div>
        <div class="sm:col-span-2">
          <UiInput
            :model-value="item.unit_value !== null ? String(item.unit_value) : ''"
            label="Đơn giá (đ)"
            type="number"
            number-mode="currency"
            density="compact"
            placeholder="Tùy chọn"
            :disabled="disabled"
            :aria-label="`Đơn giá món ${index + 1}`"
            @update:model-value="(v: string) => update(index, { unit_value: numberOrNull(v) })"
          />
        </div>
        <div class="flex items-end gap-2 sm:col-span-2">
          <UiInput
            :model-value="item.note ?? ''"
            label="Ghi chú"
            density="compact"
            :disabled="disabled"
            :aria-label="`Ghi chú món ${index + 1}`"
            @update:model-value="(v: string) => update(index, { note: v.trim() === '' ? null : v })"
          />
          <UiButton
            v-if="!disabled"
            variant="ghost"
            size="sm"
            :data-test="`inventory-remove-${index}`"
            :aria-label="`Xóa món ${index + 1}`"
            @click="removeRow(index)"
          >
            Xóa
          </UiButton>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <UiButton v-if="!disabled" variant="secondary" size="sm" data-test="inventory-add" @click="addRow">
        Thêm món
      </UiButton>
      <p class="text-sm text-ui-muted">
        Tổng giá trị tham chiếu:
        <span class="font-medium text-ui-primary" data-test="inventory-total">{{ formatCurrency(total) }}</span>
      </p>
    </div>
  </div>
</template>
