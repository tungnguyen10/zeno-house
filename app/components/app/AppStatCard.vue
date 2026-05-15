<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  description?: string
}>()
</script>

<template>
  <div class="rounded-2xl border border-dark-border bg-dark-surface p-5">
    <p class="text-xs font-medium text-muted uppercase tracking-wide">{{ title }}</p>
    <p class="mt-2 text-3xl font-semibold text-white">{{ value }}</p>
    <p v-if="description" class="mt-1 text-xs text-muted">{{ description }}</p>
  </div>
</template>
