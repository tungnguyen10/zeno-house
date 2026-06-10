<script setup lang="ts">
/**
 * Operational filter/action toolbar.
 *
 * Layout:
 *   default slot → left group (filters, search, status chips)
 *   #actions slot → right group (refresh, export, create)
 *
 * Controls placed inside should keep a stable height (`h-9` / `py-2`) to align
 * with `UiInput`, `UiSelect`, and `UiButton` size="md".
 */
</script>

<template>
  <div
    class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
  >
    <div class="flex flex-1 flex-wrap items-center gap-2 min-w-0">
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
