<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  as?: 'div' | 'section' | 'article'
  density?: 'compact' | 'default'
}>()

const panelClass = computed(() =>
  clsx(
    'rounded-xl border border-dark-border bg-dark-surface',
    props.density === 'compact' ? 'p-4' : 'p-5',
  ),
)
</script>

<template>
  <component :is="as ?? 'div'" :class="panelClass">
    <slot />
  </component>
</template>
