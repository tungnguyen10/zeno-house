<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  /** Primary metric label (Vietnamese). */
  label: string
  /** Primary value. Pass already-formatted strings (currency, count). */
  value: string | number
  /** Optional supporting label below the value (e.g. "so với tháng trước"). */
  caption?: string
  /** Optional accent for the value (e.g. success/danger semantics). */
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
  /** Optional loading state — renders skeletons in place of label/value. */
  loading?: boolean
  /** Borderless cell for use inside a divided metric card; caption becomes a tooltip. */
  flat?: boolean
}>()

// Tone expressed as a structural left-border stripe — flat/minimal signal.
const accentBorder: Record<string, string> = {
  default: 'border-l-dark-border',
  accent: 'border-l-cyan',
  success: 'border-l-status-success',
  warning: 'border-l-warning',
  danger: 'border-l-status-danger',
}

// Value retains semantic color for scannability in ops context.
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
    :class="props.flat
      ? 'flex flex-col gap-0.5 bg-ui-surface px-3 py-1.5 sm:gap-1 sm:px-3.5 sm:py-2'
      : clsx('flex flex-col gap-1 border-l-2 py-2 pl-3', accentBorder[tone ?? 'default'])"
    :title="props.flat ? caption : undefined"
  >
    <p :class="clsx('text-[10px] font-medium uppercase text-ui-muted', props.flat ? 'tracking-wide' : 'tracking-widest')">{{ label }}</p>
    <UiSkeleton v-if="loading" class="h-5 w-20" />
    <p
      v-else
      :class="clsx('font-semibold tabular-nums leading-none', props.flat ? 'text-base sm:text-lg' : 'text-lg', valueColor[tone ?? 'default'])"
    >
      {{ value }}
    </p>
    <p v-if="caption && !loading && !props.flat" class="text-[10px] text-ui-muted/60">{{ caption }}</p>
  </div>
</template>
