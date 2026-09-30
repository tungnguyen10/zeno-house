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
  labelClass?: string
  /** Render a partial / mixed state (e.g. "select all" header with some rows selected). */
  indeterminate?: boolean
  /** Accessible label when no visible `label` is rendered. */
  ariaLabel?: string
  /** `circle` renders an iOS-style round multi-select indicator instead of the default checkbox square. */
  shape?: 'square' | 'circle'
}>(), {
  modelValue: false,
  disabled: false,
  indeterminate: false,
  shape: 'square',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const generatedId = useId()
const checkboxId = computed(() => props.id ?? generatedId)

const boxClass = computed(() =>
  clsx(
    'peer size-4 appearance-none border bg-ui-surface transition-colors',
    props.shape === 'circle' ? 'rounded-full' : 'rounded',
    'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-ui-accent/40',
    'checked:border-ui-accent checked:bg-ui-accent indeterminate:border-ui-accent indeterminate:bg-ui-accent',
    props.error ? 'border-status-danger/50' : 'border-ui-border-strong',
    props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
  ),
)
</script>

<template>
  <div
    class="flex flex-col gap-1"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <label
      :for="checkboxId"
      :class="clsx('flex items-start gap-2', disabled && 'cursor-not-allowed')"
    >
      <span class="relative flex size-4 shrink-0 items-center justify-center">
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
        <IconCheckSmall
          class="pointer-events-none absolute hidden size-3 text-ui-on-accent peer-checked:block peer-indeterminate:hidden"
          aria-hidden="true"
        />
        <span
          class="pointer-events-none absolute hidden h-0.5 w-2 rounded-full bg-ui-on-accent peer-indeterminate:block"
        />
      </span>
      <span v-if="label" :class="clsx('text-sm text-ui-primary select-none', labelClass)">{{ label }}</span>
    </label>
    <p v-if="error" :id="`${checkboxId}-error`" class="text-xs text-status-danger pl-6" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${checkboxId}-hint`" class="text-xs text-ui-muted pl-6">
      {{ hint }}
    </p>
  </div>
</template>
