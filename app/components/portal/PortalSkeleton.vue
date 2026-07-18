<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  variant?: 'line' | 'card' | 'statement' | 'avatar'
}>()

const skeletonClass = computed(() => clsx(
  'bg-smoke-card animate-pulse motion-reduce:animate-none',
  props.variant === 'line' && 'h-4 w-full rounded-md',
  props.variant === 'card' && 'h-24 w-full rounded-2xl',
  props.variant === 'statement' && 'h-32 w-full rounded-2xl',
  props.variant === 'avatar' && 'size-12 rounded-full',
  !props.variant && 'rounded-lg',
))
</script>

<template>
  <div
    :class="skeletonClass"
    role="status"
    aria-label="Đang tải"
  />
</template>
