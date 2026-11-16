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

const gridClass = 'sm:grid-cols-[minmax(0,1.4fr)_5rem_9rem_9rem_minmax(0,1fr)_2.25rem] sm:gap-3'

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
    <div
      v-if="modelValue.length === 0"
      class="rounded-xl border border-dashed border-ui-border-strong px-4 py-6 text-center"
    >
      <p class="text-sm text-ui-muted">Chưa có món nội thất nào.</p>
      <UiButton v-if="!disabled" class="mt-3" variant="secondary" size="sm" data-test="inventory-add" @click="addRow">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm món đầu tiên
      </UiButton>
    </div>

    <template v-else>
      <div
        class="hidden gap-3 px-3 text-xs font-medium uppercase tracking-wide text-ui-muted sm:grid"
        :class="gridClass"
        aria-hidden="true"
      >
        <span>Tên</span>
        <span>Số lượng</span>
        <span>Tình trạng</span>
        <span>Đơn giá</span>
        <span>Ghi chú</span>
        <span />
      </div>

      <ul class="space-y-2">
        <li
          v-for="(item, index) in modelValue"
          :key="index"
          class="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-ui-border bg-ui-surface p-3 sm:items-start sm:py-2"
          :class="gridClass"
        >
          <div class="col-span-2 sm:col-span-1">
            <span class="mb-1 block text-xs text-ui-muted sm:hidden">Tên</span>
            <UiInput
              :model-value="item.name"
              density="compact"
              :disabled="disabled"
              :aria-label="`Tên món ${index + 1}`"
              @update:model-value="(v: string) => update(index, { name: v })"
            />
            <p v-if="errors[`${index}.name`]" class="mt-1 text-xs text-ui-danger">{{ errors[`${index}.name`] }}</p>
          </div>
          <div>
            <span class="mb-1 block text-xs text-ui-muted sm:hidden">Số lượng</span>
            <UiInput
              :model-value="String(item.quantity)"
              type="number"
              number-mode="integer"
              density="compact"
              :disabled="disabled"
              :aria-label="`Số lượng món ${index + 1}`"
              @update:model-value="(v: string) => update(index, { quantity: Math.max(1, Number(v) || 1) })"
            />
          </div>
          <div>
            <span class="mb-1 block text-xs text-ui-muted sm:hidden">Tình trạng</span>
            <UiSelect
              :model-value="item.condition"
              :options="conditionOptions"
              density="compact"
              :disabled="disabled"
              :aria-label="`Tình trạng món ${index + 1}`"
              @update:model-value="(v) => update(index, { condition: v as InventoryItemInput['condition'] })"
            />
          </div>
          <div class="col-span-2 sm:col-span-1">
            <span class="mb-1 block text-xs text-ui-muted sm:hidden">Đơn giá</span>
            <UiInput
              :model-value="item.unit_value !== null ? String(item.unit_value) : ''"
              type="number"
              number-mode="currency"
              density="compact"
              placeholder="Tùy chọn"
              :disabled="disabled"
              :aria-label="`Đơn giá món ${index + 1}`"
              @update:model-value="(v: string) => update(index, { unit_value: numberOrNull(v) })"
            />
          </div>
          <div class="col-span-2 flex items-start gap-2 sm:col-span-2 sm:contents">
            <div class="min-w-0 flex-1">
              <span class="mb-1 block text-xs text-ui-muted sm:hidden">Ghi chú</span>
              <UiInput
                :model-value="item.note ?? ''"
                density="compact"
                :disabled="disabled"
                :aria-label="`Ghi chú món ${index + 1}`"
                @update:model-value="(v: string) => update(index, { note: v.trim() === '' ? null : v })"
              />
            </div>
            <UiButton
              v-if="!disabled"
              variant="ghost"
              size="sm"
              class="mt-5 shrink-0 sm:mt-0"
              :data-test="`inventory-remove-${index}`"
              :aria-label="`Xóa món ${index + 1}`"
              @click="removeRow(index)"
            >
              <IconTrash class="h-4 w-4" aria-hidden="true" />
            </UiButton>
          </div>
        </li>
      </ul>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UiButton v-if="!disabled" variant="secondary" size="sm" data-test="inventory-add" @click="addRow">
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Thêm món
        </UiButton>
        <p class="ml-auto text-sm text-ui-muted">
          Tổng giá trị tham chiếu:
          <span class="font-medium tabular-nums text-ui-primary" data-test="inventory-total">{{ formatCurrency(total) }}</span>
        </p>
      </div>
    </template>
  </div>
</template>
