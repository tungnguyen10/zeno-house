<script setup lang="ts">
import clsx from 'clsx'

/**
 * Shared "select all on this page" row for surfaces with bulk selection.
 * Pairs with `UiBulkActionsBar`, which shows the actions for the selection.
 */
const props = withDefaults(defineProps<{
  modelValue: boolean
  indeterminate?: boolean
  /** Number of rows on the current page/filter, shown next to the label. */
  pageCount: number
  /** Total selected, shown on the trailing side. Hidden when 0. */
  totalSelected: number
  disabled?: boolean
  /** Helper text under the row explaining what the selection is for. */
  description?: string
  /** `bare` drops the panel chrome for nesting inside an existing panel. */
  variant?: 'panel' | 'bare'
  ariaLabel?: string
}>(), {
  indeterminate: false,
  disabled: false,
  variant: 'panel',
  ariaLabel: 'Chọn tất cả trên trang',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const rootClass = computed(() =>
  clsx(
    'flex flex-col gap-1',
    props.variant === 'panel' && 'mb-3 rounded-lg border border-ui-border bg-ui-deep/40 px-3 py-2',
  ),
)
</script>

<template>
  <div :class="rootClass">
    <div class="flex items-center justify-between gap-3">
      <UiCheckbox
        :model-value="modelValue"
        :indeterminate="indeterminate"
        :disabled="disabled"
        :label="`Chọn cả trang (${pageCount})`"
        :aria-label="ariaLabel"
        shape="circle"
        class="[&>label]:min-h-11 [&>label]:items-center"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <span v-if="totalSelected > 0" class="shrink-0 text-xs tabular-nums text-ui-muted">
        {{ totalSelected }} đã chọn
      </span>
    </div>
    <p v-if="description" class="text-xs text-ui-muted">{{ description }}</p>
  </div>
</template>
