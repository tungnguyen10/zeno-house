<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  label?: string
  type?: string
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  id?: string
}>(), {
  type: 'text',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// Auto-generate id if not provided
const inputId = computed(() => props.id ?? `ui-input-${Math.random().toString(36).slice(2, 9)}`)

const inputClass = computed(() =>
  clsx(
    'block w-full rounded-md border px-3 py-2 bg-dark-surface text-white placeholder-muted',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    props.error
      ? 'border-error/50 focus:border-error/60 focus:ring-error/30'
      : 'border-dark-border focus:border-cyan/70 focus:ring-cyan/30',
    props.disabled && 'bg-dark-hover text-muted cursor-not-allowed',
  )
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="inputId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined"
      :class="inputClass"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />

    <p v-if="error" :id="`${inputId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
