<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  rows?: number
  /** When `false`, locks resize. Defaults to `vertical` resize. */
  resize?: 'none' | 'vertical' | 'both'
  id?: string
  /**
   * `normal` — default form field sizing (py-2).
   * `compact` — dense table-cell sizing (py-1 text-xs).
   */
  density?: 'normal' | 'compact'
  /** Marks the field so a parent modal/drawer focuses it when opened. */
  autofocus?: boolean
}>(), {
  required: false,
  disabled: false,
  rows: 3,
  resize: 'vertical',
  density: 'normal',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur', event: FocusEvent): void
}>()

const generatedId = useId()
const textareaId = computed(() => props.id ?? generatedId)

const textareaClass = computed(() =>
  clsx(
    'block w-full rounded-md border px-3 bg-ui-surface text-ui-primary placeholder-ui-muted',
    props.density === 'compact' ? 'py-1 text-sm sm:text-xs' : 'py-2 text-base sm:text-sm',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    {
      'resize-none': props.resize === 'none',
      'resize-y': props.resize === 'vertical',
      resize: props.resize === 'both',
    },
    props.error
      ? 'border-status-danger/50 focus:border-status-danger/60 focus:ring-status-danger/30'
      : 'border-ui-border-strong focus:border-ui-accent/70 focus:ring-ui-accent/30',
    props.disabled && 'bg-ui-hover text-ui-muted cursor-not-allowed',
  ),
)
</script>

<template>
  <div
    class="ui-field flex flex-col gap-1.5"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <label
      v-if="label"
      :for="textareaId"
      class="text-sm font-medium text-ui-muted"
    >
      {{ label }}
      <span v-if="required" class="text-status-danger ml-0.5" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="textareaId"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :rows="rows"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined"
      :data-autofocus="autofocus ? '' : undefined"
      :class="textareaClass"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @blur="emit('blur', $event)"
    />

    <p v-if="error" :id="`${textareaId}-error`" class="text-xs text-status-danger" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${textareaId}-hint`" class="text-xs text-ui-muted">
      {{ hint }}
    </p>
  </div>
</template>
