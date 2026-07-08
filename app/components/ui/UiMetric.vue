<script setup lang="ts">
import clsx from 'clsx'

defineProps<{
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
}>()

// Tone expressed as a structural left-border stripe — flat/minimal signal.
const accentBorder: Record<string, string> = {
  default: 'border-l-dark-border',
  accent: 'border-l-cyan',
  success: 'border-l-success-neon',
  warning: 'border-l-warning',
  danger: 'border-l-error-vivid',
}

// Value retains semantic color for scannability in ops context.
const valueColor: Record<string, string> = {
  default: 'text-white',
  accent: 'text-cyan',
  success: 'text-success-neon',
  warning: 'text-warning',
  danger: 'text-error-vivid',
}
</script>

<template>
  <div :class="clsx('flex flex-col gap-1 border-l-2 py-2 pl-3', accentBorder[tone ?? 'default'])">
    <p class="text-[10px] font-medium uppercase tracking-widest text-muted">{{ label }}</p>
    <UiSkeleton v-if="loading" class="h-5 w-20" />
    <p
      v-else
      :class="clsx('text-lg font-semibold tabular-nums leading-none', valueColor[tone ?? 'default'])"
    >
      {{ value }}
    </p>
    <p v-if="caption && !loading" class="text-[10px] text-muted/60">{{ caption }}</p>
  </div>
</template>
