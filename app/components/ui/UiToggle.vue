<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  /** Visible label text. When omitted, supply `ariaLabel` for accessibility. */
  label?: string
  ariaLabel?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}>(), {
  modelValue: false,
  disabled: false,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}

const trackClass = computed(() =>
  clsx(
    'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40',
    props.size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
    props.modelValue ? 'bg-cyan' : 'bg-dark-border',
    props.disabled && 'opacity-50 cursor-not-allowed',
  ),
)

const thumbClass = computed(() =>
  clsx(
    'pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition',
    props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
    props.modelValue
      ? props.size === 'sm' ? 'translate-x-4' : 'translate-x-5'
      : 'translate-x-0',
  ),
)
</script>

<template>
  <label :class="clsx('inline-flex items-center gap-3 select-none', !disabled && 'cursor-pointer')">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="!label ? ariaLabel : undefined"
      :disabled="disabled"
      :class="trackClass"
      @click="toggle"
    >
      <span :class="thumbClass" />
    </button>
    <span v-if="label" class="text-sm text-white">{{ label }}</span>
  </label>
</template>
