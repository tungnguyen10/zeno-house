<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  /**
   * Accessible label. Required when the button renders only an icon
   * (no readable slot content) so screen readers announce the action.
   */
  ariaLabel?: string
  /** Square padding for icon-only usage. */
  iconOnly?: boolean
  /** Let callers own the visual layout while still using the shared button primitive. */
  unstyled?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
  iconOnly: false,
  unstyled: false,
})

const buttonClass = computed(() =>
  props.unstyled
    ? clsx({
        'opacity-50 cursor-not-allowed pointer-events-none': props.disabled || props.loading,
      })
    : clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
        !props.iconOnly && {
          'px-3 py-1.5 text-xs': props.size === 'sm',
          'px-4 py-2 text-sm': props.size === 'md',
          'px-5 py-2.5 text-sm': props.size === 'lg',
        },
        props.iconOnly && {
          'h-7 w-7 text-xs': props.size === 'sm',
          'h-9 w-9 text-sm': props.size === 'md',
          'h-10 w-10 text-sm': props.size === 'lg',
        },
        // Variant
        {
          'bg-cyan text-dark-deep hover:bg-cyan/90 focus-visible:ring-cyan':
            props.variant === 'primary',
          'bg-dark-surface text-white border border-dark-border hover:bg-dark-hover focus-visible:ring-dark-border':
            props.variant === 'secondary',
          'bg-error text-white hover:bg-error/85 focus-visible:ring-error':
            props.variant === 'danger',
          'bg-transparent text-muted hover:bg-dark-hover hover:text-white focus-visible:ring-dark-border':
            props.variant === 'ghost',
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
    :aria-label="ariaLabel"
  >
    <IconSpinner
      v-if="loading"
      class="animate-spin h-4 w-4 shrink-0"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
