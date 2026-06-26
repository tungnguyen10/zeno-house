<script setup lang="ts">
/**
 * Titled content region — header + body without forcing nested cards.
 *
 * Slots:
 *   default → body content
 *   #actions → optional right-side action group in the section header
 *   #description → optional description rendered below the title
 */

defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <section class="space-y-3">
    <header
      v-if="title || $slots.actions || description || $slots.description"
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="min-w-0">
        <h2 v-if="title" class="text-sm font-semibold text-white">{{ title }}</h2>
        <p v-if="description" class="text-xs text-muted mt-0.5">{{ description }}</p>
        <slot name="description" />
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </header>
    <div class="space-y-3">
      <slot />
    </div>
  </section>
</template>
