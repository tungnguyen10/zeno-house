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
  neutral: 'bg-ui-surface text-ui-muted',
  accent: 'bg-ui-accent/10 text-ui-accent',
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
  danger: 'bg-status-danger-surface text-status-danger',
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
