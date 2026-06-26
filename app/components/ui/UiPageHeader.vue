<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * Operational page header.
 *
 * Props:
 *   title       → page title (required)
 *   description → optional one-line context shown under the title
 *   backTo      → optional route. When set, renders a small back-link above
 *                 the title (icon + label). Use this for detail/workspace
 *                 pages instead of placing a back-button inside #actions.
 *   backLabel   → label shown next to the back-link arrow (default: 'Quay lại')
 *
 * Slots:
 *   default → optional content rendered below description (e.g. breadcrumbs)
 *   #actions → right-side action group (do NOT place back navigation here)
 */

defineProps<{
  title: string
  description?: string
  backTo?: RouteLocationRaw
  backLabel?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
    <div class="min-w-0">
      <NuxtLink
        v-if="backTo"
        :to="backTo"
        class="inline-flex items-center gap-1 text-xs text-muted hover:text-white mb-1"
      >
        <IconArrowLeft class="w-3.5 h-3.5" aria-hidden="true" />
        {{ backLabel ?? 'Quay lại' }}
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white">{{ title }}</h1>
      <p v-if="description" class="text-sm text-muted mt-0.5">{{ description }}</p>
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
