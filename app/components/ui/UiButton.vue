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
          'size-7 text-xs': props.size === 'sm',
          'size-9 text-sm': props.size === 'md',
          'size-10 text-sm': props.size === 'lg',
        },
        // Variant
        {
          'bg-ui-accent text-ui-on-accent hover:bg-ui-accent/90 focus-visible:ring-ui-accent':
            props.variant === 'primary',
          'bg-ui-surface text-ui-primary border border-ui-border-strong hover:bg-ui-hover focus-visible:ring-ui-border-strong':
            props.variant === 'secondary',
          'bg-status-danger text-status-on-danger hover:bg-status-danger/85 focus-visible:ring-status-danger':
            props.variant === 'danger',
          'bg-transparent text-ui-muted hover:bg-ui-hover hover:text-ui-primary focus-visible:ring-ui-border-strong':
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
      class="size-4 shrink-0 animate-spin"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
