<script setup lang="ts">
/**
 * Shared shell for list-page toolbars (optional search + filter + optional sort).
 *
 * Layout: search input and the filter trigger share row 1 on mobile; an
 * optional `#sort` slot (e.g. `UiSortControl`) wraps to its own row once
 * space runs out. Domain toolbars own their filter fields (via `#filters`)
 * and sort options — this primitive only owns the compact responsive shell.
 */
const props = withDefaults(defineProps<{
  /** Omit to render a filter-only toolbar (report pages have nothing to search). */
  search?: string
  searchPlaceholder?: string
  searchAriaLabel?: string
  searchDebounce?: number
  filterCount?: number
  filterAriaLabel: string
  filterPanelClass?: string
  hasActiveFilters?: boolean
}>(), {
  searchDebounce: 250,
  filterCount: 0,
})

const hasSearch = computed(() => props.searchAriaLabel !== undefined)

const emit = defineEmits<{
  'update:search': [value: string]
  reset: []
}>()
</script>

<template>
  <UiToolbar>
    <UiSearchInput
      v-if="hasSearch"
      :model-value="search ?? ''"
      :placeholder="searchPlaceholder"
      :aria-label="searchAriaLabel!"
      :debounce="searchDebounce"
      class="min-w-[9rem] flex-1 sm:w-72 sm:flex-none"
      @update:model-value="emit('update:search', $event)"
    />

    <UiFilterPopover
      :count="filterCount"
      class="shrink-0"
      :aria-label="filterAriaLabel"
      :panel-class="filterPanelClass"
    >
      <slot name="filters" />
    </UiFilterPopover>

    <slot name="sort" />

    <template v-if="hasActiveFilters" #actions>
      <UiFilterResetButton @click="emit('reset')" />
    </template>
  </UiToolbar>
</template>
