<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  padded?: boolean
  interactive?: boolean
}>(), {
  padded: true,
  interactive: false,
})

const cardClass = computed(() =>
  clsx(
    'rounded-2xl bg-white border border-border-light shadow-sm',
    props.padded && 'p-4',
    props.interactive && 'transition-colors hover:bg-smoke active:bg-smoke cursor-pointer',
  ),
)
</script>

<template>
  <div :class="cardClass">
    <slot />
  </div>
</template>
