<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
})

const buttonClass = computed(() =>
  clsx(
    'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    // Size
    {
      'px-3 py-1.5 text-xs': props.size === 'sm',
      'px-4 py-2 text-sm': props.size === 'md',
      'px-5 py-2.5 text-sm': props.size === 'lg',
    },
    // Variant
    {
      'bg-cyan text-dark-deep hover:bg-cyan/90 focus-visible:ring-cyan':
        props.variant === 'primary',
      'bg-dark-surface text-white border border-dark-border hover:bg-dark-hover focus-visible:ring-dark-border':
        props.variant === 'secondary',
      'bg-error text-white hover:bg-error/85 focus-visible:ring-error':
        props.variant === 'danger',
    },
    // State
    {
      'opacity-50 cursor-not-allowed pointer-events-none': props.disabled || props.loading,
    },
  )
)
</script>

<template>
  <button
    :type="type"
    :class="buttonClass"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading"
    :aria-busy="loading"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <slot />
  </button>
</template>
