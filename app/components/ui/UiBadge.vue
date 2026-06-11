<script setup lang="ts">
import clsx from 'clsx'
import type { StatusVariant } from '~/utils/constants/statuses'

const props = withDefaults(defineProps<{
  variant?: StatusVariant
  size?: 'sm' | 'md'
  /** When set, renders a `rounded-full` pill (status). Defaults to `rounded-md` (label). */
  pill?: boolean
}>(), {
  variant: 'neutral',
  size: 'sm',
  pill: false,
})

const variantClass: Record<StatusVariant, string> = {
  neutral: 'bg-dark-surface text-muted',
  accent: 'bg-cyan/10 text-cyan',
  success: 'bg-success-neon/10 text-success-neon',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-error-bg text-error-vivid',
}

const badgeClass = computed(() =>
  clsx(
    'inline-flex items-center font-medium whitespace-nowrap',
    props.size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
    props.pill ? 'rounded-full' : 'rounded-md',
    variantClass[props.variant],
  ),
)
</script>

<template>
  <span :class="badgeClass">
    <slot />
  </span>
</template>
