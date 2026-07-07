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

const toneClass: Record<string, string> = {
  default: 'text-white',
  accent: 'text-cyan',
  success: 'text-success-neon',
  warning: 'text-warning',
  danger: 'text-error-vivid',
}
</script>

<template>
  <div class="flex flex-col gap-0.5 rounded-xl border border-dark-border bg-dark-surface px-3 py-2.5">
    <p class="text-xs uppercase tracking-wide text-muted">{{ label }}</p>
    <UiSkeleton v-if="loading" class="h-6 w-24" />
    <p
      v-else
      :class="clsx('text-lg font-semibold tabular-nums', toneClass[tone ?? 'default'])"
    >
      {{ value }}
    </p>
    <p v-if="caption && !loading" class="text-xs text-muted">{{ caption }}</p>
  </div>
</template>
