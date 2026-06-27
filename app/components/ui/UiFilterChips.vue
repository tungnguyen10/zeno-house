<script setup lang="ts" generic="T extends string | number">
export interface FilterChipOption<V extends string | number> {
  value: V
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: T[]
  options: FilterChipOption<T>[]
  ariaLabel?: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: T[]): void
}>()

function isActive(value: T) {
  return props.modelValue.includes(value)
}

function toggle(value: T) {
  if (props.disabled) return
  const next = isActive(value)
    ? props.modelValue.filter(v => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1.5"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      :aria-pressed="isActive(option.value)"
      :disabled="disabled"
      :class="[
        'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30',
        isActive(option.value)
          ? 'border-cyan/40 bg-cyan/10 text-cyan'
          : 'border-dark-border bg-dark-surface text-muted hover:border-dark-border hover:text-white',
        disabled && 'cursor-not-allowed opacity-60',
      ]"
      @click="toggle(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
