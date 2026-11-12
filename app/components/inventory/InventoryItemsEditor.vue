<script setup lang="ts">
import { computed } from 'vue'
import { INVENTORY_CONDITION_LABELS } from '~/types/inventory'
import { inventoryTotalValue } from '~/utils/mappers/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'

const ITEM_LIMIT = 50

const props = withDefaults(defineProps<{
  modelValue: InventoryItemInput[]
  disabled?: boolean
  errors?: Record<string, string>
}>(), {
  disabled: false,
  errors: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: InventoryItemInput[]): void
}>()

const conditionOptions = Object.entries(INVENTORY_CONDITION_LABELS).map(([value, label]) => ({ value, label }))

const total = computed(() => inventoryTotalValue(props.modelValue.map(item => ({
  quantity: item.quantity,
  unitValue: item.unit_value,
}))))

function patch(index: number, change: Partial<InventoryItemInput>) {
  emit('update:modelValue', props.modelValue.map((item, i) => (i === index ? { ...item, ...change } : item)))
}

function add() {
  if (props.modelValue.length >= ITEM_LIMIT) return
  emit('update:modelValue', [
    ...props.modelValue,
    { name: '', quantity: 1, condition: 'good', unit_value: null, note: null },
  ])
}

function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

const toInt = (raw: string, min: number) => Math.max(min, Math.trunc(Number(raw)) || min)
</script>

<template>
  <div class="min-w-0 space-y-3">
    <div
      v-if="modelValue.length"
      class="hidden grid-cols-[minmax(0,2fr)_5rem_9rem_9rem_minmax(0,2fr)_2.25rem] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-ui-muted md:grid"
      aria-hidden="true"
    >
      <span>Tên</span>
      <span>SL</span>
      <span>Tình trạng</span>
      <span>Giá trị (đ)</span>
      <span>Ghi chú</span>
      <span />
    </div>

    <ul v-if="modelValue.length" class="space-y-2" data-test="inventory-rows">
      <li
        v-for="(item, index) in modelValue"
        :key="index"
        class="grid grid-cols-2 items-start gap-2 rounded-xl border border-ui-border p-3 md:grid-cols-[minmax(0,2fr)_5rem_9rem_9rem_minmax(0,2fr)_2.25rem] md:border-0 md:p-0"
      >
        <div class="col-span-2 min-w-0 md:col-span-1">
          <span class="mb-1 block text-xs text-ui-muted md:hidden">Tên</span>
          <UiInput
            density="compact"
            :aria-label="`Tên món ${index + 1}`"
            :model-value="item.name"
            :error="errors[`${index}.name`]"
            :disabled="disabled"
            placeholder="Ví dụ: Giường"
            @update:model-value="(v: string) => patch(index, { name: v })"
          />
        </div>
        <div class="min-w-0">
          <span class="mb-1 block text-xs text-ui-muted md:hidden">Số lượng</span>
          <UiInput
            density="compact"
            type="number"
            number-mode="integer"
            min="1"
            max="999"
            :aria-label="`Số lượng món ${index + 1}`"
            :model-value="String(item.quantity)"
            :error="errors[`${index}.quantity`]"
            :disabled="disabled"
            @update:model-value="(v: string) => patch(index, { quantity: Math.min(999, toInt(v, 1)) })"
          />
        </div>
        <div class="min-w-0">
          <span class="mb-1 block text-xs text-ui-muted md:hidden">Tình trạng</span>
          <UiSelect
            density="compact"
            :aria-label="`Tình trạng món ${index + 1}`"
            :model-value="item.condition"
            :options="conditionOptions"
            :disabled="disabled"
            @update:model-value="(v) => patch(index, { condition: v as InventoryItemInput['condition'] })"
          />
        </div>
        <div class="min-w-0">
          <span class="mb-1 block text-xs text-ui-muted md:hidden">Giá trị (đ)</span>
          <UiInput
            density="compact"
            type="number"
            number-mode="currency"
            :aria-label="`Giá trị món ${index + 1}`"
            :model-value="item.unit_value === null ? '' : String(item.unit_value)"
            :error="errors[`${index}.unit_value`]"
            :disabled="disabled"
            placeholder="Tùy chọn"
            @update:model-value="(v: string) => patch(index, { unit_value: v === '' ? null : Math.max(0, Math.trunc(Number(v)) || 0) })"
          />
        </div>
        <div class="min-w-0 md:col-span-1">
          <span class="mb-1 block text-xs text-ui-muted md:hidden">Ghi chú</span>
          <UiInput
            density="compact"
            :aria-label="`Ghi chú món ${index + 1}`"
            :model-value="item.note ?? ''"
            :error="errors[`${index}.note`]"
            :disabled="disabled"
            placeholder="Tùy chọn"
            @update:model-value="(v: string) => patch(index, { note: v === '' ? null : v })"
          />
        </div>
        <div class="flex items-end justify-end md:items-start">
          <UiButton
            variant="ghost"
            size="sm"
            icon-only
            :disabled="disabled"
            :aria-label="`Xóa món ${index + 1}`"
            :data-test="`inventory-remove-${index}`"
            @click="remove(index)"
          >
            <IconTrash class="size-4" aria-hidden="true" />
          </UiButton>
        </div>
      </li>
    </ul>
    <p v-else class="rounded-xl border border-dashed border-ui-border px-4 py-6 text-center text-sm text-ui-muted">
      Chưa có món nội thất nào.
    </p>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UiButton
        variant="secondary"
        size="sm"
        data-test="inventory-add"
        :disabled="disabled || modelValue.length >= ITEM_LIMIT"
        @click="add"
      >
        <IconPlus class="size-4" aria-hidden="true" />
        Thêm món
      </UiButton>
      <p class="text-sm text-ui-muted">
        <span v-if="modelValue.length >= ITEM_LIMIT" class="mr-2">Đã đạt tối đa {{ ITEM_LIMIT }} món.</span>
        Tổng giá trị:
        <span class="font-medium tabular-nums text-ui-primary" data-test="inventory-total">{{ total.toLocaleString('vi-VN') }} đ</span>
      </p>
    </div>
  </div>
</template>
