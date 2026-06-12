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
  /**
   * `normal` — default form field sizing (py-2).
   * `compact` — dense table-cell / matrix sizing (py-1 text-xs).
   */
  density?: 'normal' | 'compact'
}>(), {
  modelValue: null,
  required: false,
  disabled: false,
  density: 'normal',
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
    'block w-full appearance-none rounded-md border bg-dark-surface px-3 pr-9 text-white',
    props.density === 'compact' ? 'py-1 text-xs' : 'py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
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

    <div class="relative">
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
      <IconChevronDown
        class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>

    <p v-if="error" :id="`${selectId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${selectId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
