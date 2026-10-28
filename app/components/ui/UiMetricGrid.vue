<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  /** Columns from `md` up. Below `md` the grid always uses two columns. */
  cols?: 2 | 3 | 4 | 5
  /** Below `md`, render cells as an edge-to-edge scrolling chip strip (pair with `UiMetricTile`). */
  chips?: boolean
}>(), {
  cols: 3,
})

// Static class map so Tailwind can see every variant.
const colsClass: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
}

const classes = computed(() => clsx(
  props.chips
    // Negative margins match the page padding (p-4 / sm:p-6) so chips scroll to the screen edge.
    ? 'flex snap-x gap-2 overflow-x-auto px-4 -mx-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:gap-0 md:overflow-hidden md:rounded-xl md:border md:border-ui-border md:bg-ui-surface md:px-0'
    : 'grid grid-cols-2 overflow-hidden rounded-xl border border-ui-border bg-ui-surface max-md:[&>*:last-child:nth-child(odd)]:col-span-2',
  colsClass[props.cols],
))
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
