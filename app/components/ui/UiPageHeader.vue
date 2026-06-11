<script setup lang="ts">
/**
 * Operational page header.
 *
 * Slots:
 *   default → optional content rendered below description (e.g. breadcrumbs)
 *   #actions → right-side action group
 */

defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
    <div class="min-w-0">
      <h1 class="text-xl font-semibold text-white">{{ title }}</h1>
      <p v-if="description" class="text-sm text-muted mt-0.5">{{ description }}</p>
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
