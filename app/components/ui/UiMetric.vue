<script setup lang="ts">
import clsx from 'clsx'

withDefaults(defineProps<{
  /** Primary metric label (Vietnamese). */
  label: string
  /** Primary value. Pass already-formatted strings (currency, count). */
  value: string | number
  /** Optional supporting line below the value. */
  caption?: string
  /** Optional tooltip for secondary context that should not take vertical space. */
  hint?: string
  /** Semantic color for the value (success/danger/etc.). */
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
  /** Renders a skeleton in place of the value. */
  loading?: boolean
}>(), {
  tone: 'default',
})

const valueColor: Record<string, string> = {
  default: 'text-ui-primary',
  accent: 'text-ui-accent',
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
}
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-0.5 bg-ui-surface px-3 py-1.5 shadow-[0_0_0_0.5px_rgb(var(--ui-border))] sm:gap-1 sm:px-3.5 sm:py-2"
    :title="hint"
  >
    <p class="text-[10px] font-medium uppercase tracking-wide text-ui-muted">{{ label }}</p>
    <UiSkeleton v-if="loading" class="h-5 w-20" />
    <p
      v-else
      :class="clsx('text-base font-semibold tabular-nums leading-none sm:text-lg', valueColor[tone])"
    >
      {{ value }}
    </p>
    <p v-if="caption && !loading" class="text-[10px] text-ui-muted/60">{{ caption }}</p>
  </div>
</template>
