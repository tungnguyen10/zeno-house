<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  label: string
  value?: string | number | null
  /** Put the value on its own line — for addresses, notes and other long-form text. */
  stacked?: boolean
}>()

const rowClass = computed(() =>
  clsx('py-2.5', !props.stacked && 'flex items-baseline justify-between gap-4'),
)

const valueClass = computed(() =>
  clsx(
    'min-w-0 break-words text-sm text-ui-primary',
    props.stacked ? 'mt-0.5' : 'text-right',
  ),
)
</script>

<template>
  <div :class="rowClass">
    <dt class="shrink-0 text-xs text-ui-muted">{{ label }}</dt>
    <dd :class="valueClass">
      <slot>{{ value ?? '---' }}</slot>
    </dd>
  </div>
</template>
