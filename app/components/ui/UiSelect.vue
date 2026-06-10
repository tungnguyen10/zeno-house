<script setup lang="ts">
import clsx from 'clsx'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  label?: string
  options: SelectOption[]
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  id?: string
}>(), {
  modelValue: null,
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | null): void
}>()

const generatedId = useId()
const selectId = computed(() => props.id ?? generatedId)

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  if (target.value === '') {
    emit('update:modelValue', null)
    return
  }
  // Preserve numeric values when the matching option is numeric
  const match = props.options.find(o => String(o.value) === target.value)
  emit('update:modelValue', match ? match.value : target.value)
}

const selectClass = computed(() =>
  clsx(
    'block w-full rounded-md border bg-dark-surface px-3 py-2 text-sm text-white',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    // Native select arrow on dark theme: hide default and re-add via background image
    'appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem_1rem]',
    "bg-[url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2398989D'%3e%3cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3e%3c/svg%3e\")]",
    'pr-9',
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
      :for="selectId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <select
      :id="selectId"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :required="required"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined"
      :class="selectClass"
      @change="onChange"
    >
      <option v-if="placeholder" value="" :disabled="required">
        {{ placeholder }}
      </option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

    <p v-if="error" :id="`${selectId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${selectId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
