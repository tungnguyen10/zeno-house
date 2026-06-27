<script setup lang="ts" generic="T extends string">
import type { SelectOption } from './UiSelect.vue'

type SortOrder = 'asc' | 'desc'

const props = withDefaults(defineProps<{
  modelValue: T
  order: SortOrder
  options: SelectOption[]
  ariaLabel?: string
  ariaLabelAsc?: string
  ariaLabelDesc?: string
}>(), {
  ariaLabel: 'Sắp xếp',
  ariaLabelAsc: 'Sắp xếp tăng dần',
  ariaLabelDesc: 'Sắp xếp giảm dần',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
  (e: 'update:order', value: SortOrder): void
}>()

function onSortChange(value: string | number | null) {
  if (value === null) return
  emit('update:modelValue', String(value) as T)
}

function toggleOrder() {
  emit('update:order', props.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UiSelect
      :model-value="modelValue"
      :options="options"
      density="compact"
      :aria-label="ariaLabel"
      class="min-w-[9rem]"
      @update:model-value="onSortChange"
    />
    <UiButton
      variant="secondary"
      size="sm"
      icon-only
      :aria-label="order === 'asc' ? ariaLabelAsc : ariaLabelDesc"
      @click="toggleOrder"
    >
      <IconArrowUp
        :class="['h-4 w-4 transition-transform', order === 'desc' && 'rotate-180']"
        aria-hidden="true"
      />
    </UiButton>
  </div>
</template>
