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

const props = defineProps<{
  title: string
  description?: string
  backTo?: RouteLocationRaw
  backLabel?: string
}>()

// Mirrors `backTo` into the sticky mobile header so the back affordance stays
// reachable while the page title scrolls away with the content.
const headerBack = useAppHeaderBack()
watchEffect(() => {
  headerBack.value = props.backTo ?? null
})
onBeforeUnmount(() => {
  headerBack.value = null
})
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start gap-3 lg:pr-44">
    <div class="min-w-[12rem] flex-1">
      <NuxtLink
        v-if="backTo"
        :to="backTo"
        class="inline-flex items-center gap-1 text-xs text-ui-muted hover:text-ui-primary mb-1"
      >
        <IconArrowLeft class="w-3.5 h-3.5" aria-hidden="true" />
        {{ backLabel ?? 'Quay lại' }}
      </NuxtLink>
      <h1 class="text-xl font-semibold text-ui-primary">{{ title }}</h1>
      <p v-if="description" class="text-sm text-ui-muted mt-0.5">{{ description }}</p>
      <slot />
    </div>
    <div
      v-if="$slots.actions"
      data-page-actions
      class="ml-auto flex shrink-0 flex-wrap items-center gap-2 whitespace-nowrap"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
