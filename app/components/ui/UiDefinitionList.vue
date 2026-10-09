<script setup lang="ts">
/**
 * Record fields as iOS-Settings style rows: label left, value right, one line each.
 *
 * Pair with `UiDefinitionItem`. Use `stacked` on an item for long-form values
 * (addresses, notes) that cannot share a line with their label.
 */
</script>

<template>
  <dl class="divide-y divide-ui-border">
    <slot />
  </dl>
</template>
