<script setup lang="ts">
/**
 * Grouped-list form section: on mobile the card goes edge-to-edge with its
 * label sitting outside it (iOS Settings rhythm); from `sm` up it becomes a
 * regular inset card. Descriptions and notes render below the group.
 */
withDefaults(defineProps<{
  title: string
  description?: string
  tone?: 'default' | 'muted'
}>(), {
  description: undefined,
  tone: 'default',
})
</script>

<template>
  <section class="-mx-4 sm:mx-0">
    <header class="px-4 pb-2 sm:px-0">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-ui-muted">{{ title }}</h3>
      <p v-if="description" class="mt-1 text-xs text-ui-muted">{{ description }}</p>
    </header>

    <div
      class="space-y-4 border-y border-ui-border p-4 sm:rounded-xl sm:border sm:p-5"
      :class="tone === 'muted' ? 'bg-ui-hover/30' : 'bg-ui-surface'"
    >
      <slot />
    </div>

    <div v-if="$slots.footnote" class="px-4 pt-2 sm:px-0">
      <slot name="footnote" />
    </div>
  </section>
</template>
