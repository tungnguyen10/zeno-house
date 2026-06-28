<script setup lang="ts">
import { computed, useId, useSlots } from 'vue'
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
  /**
   * `normal` — default form field sizing (py-2).
   * `compact` — dense table-cell / matrix sizing (py-1 text-xs).
   */
  density?: 'normal' | 'compact'
}>(), {
  type: 'text',
  required: false,
  disabled: false,
  density: 'normal',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
}>()

// Stable id: prefer prop, else Vue's SSR-safe useId so the same instance keeps the same id
// across hydration. Avoids mismatched aria attributes on re-render.
const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)

const slots = useSlots()
const hasPrefix = computed(() => !!slots.prefix)
const hasSuffix = computed(() => !!slots.suffix)

const wrapperClass = computed(() =>
  clsx(
    'flex w-full items-stretch rounded-md border bg-dark-surface text-white',
    'focus-within:ring-2 focus-within:ring-offset-0',
    props.error
      ? 'border-error/50 focus-within:border-error/60 focus-within:ring-error/30'
      : 'border-dark-border focus-within:border-cyan/70 focus-within:ring-cyan/30',
    props.disabled && 'bg-dark-hover text-muted cursor-not-allowed',
  ),
)

const inputClass = computed(() =>
  clsx(
    'block w-full bg-transparent px-3 text-white placeholder-muted',
    'focus:outline-none',
    props.density === 'compact' ? 'py-1 text-xs' : 'py-2 text-sm',
    hasPrefix.value && 'pl-1',
    hasSuffix.value && 'pr-1',
    props.disabled && 'cursor-not-allowed text-muted',
  ),
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

    <div :class="wrapperClass">
      <span
        v-if="hasPrefix"
        class="flex items-center pl-3 pr-1 text-sm text-muted select-none whitespace-nowrap"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

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
        @change="emit('change', ($event.target as HTMLInputElement).value)"
        @blur="emit('blur', $event)"
      >

      <span
        v-if="hasSuffix"
        class="flex items-center pr-3 pl-1 text-sm text-muted select-none whitespace-nowrap"
        aria-hidden="true"
      >
        <slot name="suffix" />
      </span>
    </div>

    <p v-if="error" :id="`${inputId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
