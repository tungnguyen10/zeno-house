<script setup lang="ts">
/**
 * Grouped list section: compact uppercase caption, optional right-aligned
 * total, and `<li>` rows supplied by the caller.
 *
 * Use for small breakdowns where a full `UiEmptyState` would dwarf the data —
 * the empty case collapses to a single muted line instead of an icon block.
 */
defineProps<{
  title: string
  /** Right-aligned header summary — pass an already-formatted amount. */
  total?: string | null
  empty?: boolean
  emptyText?: string
}>()
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-ui-border bg-ui-surface">
    <header class="flex items-baseline justify-between gap-3 border-b border-ui-border px-3.5 py-2">
      <h3 class="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-ui-muted">
        {{ title }}
      </h3>
      <span v-if="total" class="shrink-0 text-xs font-medium tabular-nums text-ui-primary">
        {{ total }}
      </span>
    </header>

    <p v-if="empty" class="px-3.5 py-3 text-xs text-ui-muted">{{ emptyText }}</p>
    <ul v-else class="divide-y divide-ui-border">
      <slot />
    </ul>
  </section>
</template>
