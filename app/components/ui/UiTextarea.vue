<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue?: string
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
}>(), {
  required: false,
  disabled: false,
  rows: 3,
  resize: 'vertical',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const generatedId = useId()
const textareaId = computed(() => props.id ?? generatedId)

const textareaClass = computed(() =>
  clsx(
    'block w-full rounded-md border px-3 py-2 bg-dark-surface text-sm text-white placeholder-muted',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    {
      'resize-none': props.resize === 'none',
      'resize-y': props.resize === 'vertical',
      resize: props.resize === 'both',
    },
    props.error
      ? 'border-error/50 focus:border-error/60 focus:ring-error/30'
      : 'border-dark-border focus:border-cyan/70 focus:ring-cyan/30',
    props.disabled && 'bg-dark-hover text-muted cursor-not-allowed',
  ),
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="textareaId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="textareaId"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :rows="rows"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined"
      :class="textareaClass"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <p v-if="error" :id="`${textareaId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${textareaId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
