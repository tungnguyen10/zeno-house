<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  padded?: boolean
  interactive?: boolean
  accent?: 'paid' | 'due' | 'overdue'
}>(), {
  padded: true,
  interactive: false,
})

const cardClass = computed(() =>
  clsx(
    'rounded-2xl border border-border-light bg-white shadow-[var(--portal-elevation-resting)]',
    props.padded && 'p-4',
    props.accent && 'border-l-[3px]',
    {
      'border-l-portal-positive': props.accent === 'paid',
      'border-l-portal-warning': props.accent === 'due',
      'border-l-portal-danger': props.accent === 'overdue',
    },
    props.interactive && [
      'w-full cursor-pointer text-left transition-transform',
      '[transition-duration:var(--portal-motion-micro)] [transition-timing-function:var(--portal-ease-out)]',
      'hover:bg-smoke active:scale-[0.99] active:bg-smoke',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 focus-visible:ring-offset-2',
      'motion-reduce:transition-none motion-reduce:active:scale-100',
    ],
  ),
)
</script>

<template>
  <component :is="interactive ? 'button' : 'div'" :type="interactive ? 'button' : undefined" :class="cardClass">
    <slot />
  </component>
</template>
