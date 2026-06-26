<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  label?: string
  /** Optional helper text below the label. */
  hint?: string
  /** Optional error message; renders error state and message. */
  error?: string
  disabled?: boolean
  id?: string
  /** Render a partial / mixed state (e.g. "select all" header with some rows selected). */
  indeterminate?: boolean
  /** Accessible label when no visible `label` is rendered. */
  ariaLabel?: string
}>(), {
  modelValue: false,
  disabled: false,
  indeterminate: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const generatedId = useId()
const checkboxId = computed(() => props.id ?? generatedId)

const boxClass = computed(() =>
  clsx(
    'h-4 w-4 rounded border bg-dark-surface text-cyan accent-cyan',
    'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-cyan/40',
    props.error ? 'border-error/50' : 'border-dark-border',
    props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
  ),
)
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      :for="checkboxId"
      :class="clsx('flex items-start gap-2', disabled && 'cursor-not-allowed')"
    >
      <input
        :id="checkboxId"
        type="checkbox"
        :checked="modelValue"
        :indeterminate.prop="indeterminate"
        :disabled="disabled"
        :aria-invalid="!!error"
        :aria-label="ariaLabel"
        :aria-describedby="error ? `${checkboxId}-error` : hint ? `${checkboxId}-hint` : undefined"
        :class="boxClass"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span v-if="label" class="text-sm text-white select-none">{{ label }}</span>
    </label>
    <p v-if="error" :id="`${checkboxId}-error`" class="text-xs text-error pl-6" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${checkboxId}-hint`" class="text-xs text-muted pl-6">
      {{ hint }}
    </p>
  </div>
</template>
