<script setup lang="ts">
import clsx from 'clsx'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Linkable list row used by main list pages and nested section lists.
 *
 * Slots:
 *   default → primary content (title, meta). Caller composes layout inside.
 *
 * `compact` variant: smaller padding + no background — for rows nested inside
 * an already-bordered `UiSection` panel.
 */
const props = withDefaults(defineProps<{
  to: RouteLocationRaw
  compact?: boolean
}>(), {
  compact: false,
})

const rowClass = computed(() =>
  clsx(
    'group flex items-center gap-3 transition-colors',
    props.compact
      ? 'rounded-lg border border-dark-border px-3 py-2 hover:border-cyan/40'
      : 'rounded-xl border border-dark-border bg-dark-surface px-4 py-3 hover:border-cyan/40',
  ),
)

const chevronClass = computed(() =>
  clsx(
    'shrink-0 text-muted group-hover:text-cyan transition-colors',
    props.compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
  ),
)
</script>

<template>
  <NuxtLink :to="to" :class="rowClass">
    <div class="flex-1 min-w-0">
      <slot />
    </div>
    <IconChevronRight :class="chevronClass" aria-hidden="true" />
  </NuxtLink>
</template>
