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
    'peer h-4 w-4 appearance-none rounded border bg-dark-surface transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-cyan/40',
    'checked:border-cyan checked:bg-cyan indeterminate:border-cyan indeterminate:bg-cyan',
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
      <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
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
        <svg
          class="pointer-events-none absolute hidden h-3 w-3 text-dark peer-checked:block peer-indeterminate:hidden"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
        <span
          class="pointer-events-none absolute hidden h-0.5 w-2 rounded-full bg-dark peer-indeterminate:block"
        />
      </span>
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
