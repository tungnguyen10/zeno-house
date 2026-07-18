<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  /** Accessible label — required when the button is icon-only. */
  ariaLabel?: string
  iconOnly?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
  block: false,
  iconOnly: false,
})

if (props.iconOnly && !props.ariaLabel?.trim()) {
  throw new Error('PortalButton: ariaLabel is required when iconOnly is true')
}

// ≥44px touch targets for md/lg per the native-shell touch contract.
const buttonClass = computed(() =>
  clsx(
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-transform select-none',
    '[transition-duration:var(--portal-motion-micro)] [transition-timing-function:var(--portal-ease-out)]',
    'active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme/40',
    props.block && 'w-full',
    !props.iconOnly && {
      'px-3 min-h-[36px] text-sm': props.size === 'sm',
      'px-5 min-h-[44px] text-sm': props.size === 'md',
      'px-6 min-h-[52px] text-base': props.size === 'lg',
    },
    props.iconOnly && {
      'size-9 text-sm': props.size === 'sm',
      'size-11 text-base': props.size === 'md',
      'size-[52px] text-base': props.size === 'lg',
    },
    {
      'bg-theme text-[color:var(--portal-bg)] hover:bg-theme/90 active:bg-theme/95': props.variant === 'primary',
      'bg-white text-title border border-border-light hover:bg-smoke active:bg-smoke':
        props.variant === 'secondary',
      'bg-transparent text-theme hover:bg-smoke-blue active:bg-smoke-blue': props.variant === 'ghost',
      'bg-error text-white hover:bg-error/90 active:bg-error/95': props.variant === 'danger',
    },
    {
      'opacity-50 cursor-not-allowed pointer-events-none': props.disabled || props.loading,
    },
  ),
)
</script>

<template>
  <button
    :type="type"
    :class="buttonClass"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :aria-busy="loading"
  >
    <IconSpinner v-if="loading" class="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <slot />
  </button>
</template>
