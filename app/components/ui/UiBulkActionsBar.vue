<script setup lang="ts">
/**
 * Shared shell for list-page bulk-selection bars: count badge + "Bỏ chọn" +
 * a slot for domain-specific action buttons. Owns the fixed/sticky
 * positioning — `bottom-[calc(6rem+env(safe-area-inset-bottom))]` clears the
 * mobile tab bar; `lg:sticky lg:bottom-3` matches the desktop layout.
 */
withDefaults(defineProps<{
  count: number
  ariaLabel?: string
}>(), {
  ariaLabel: 'Thao tác hàng loạt',
})

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div
    role="region"
    :aria-label="ariaLabel"
    class="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-2xl border border-ui-border bg-ui-chrome/95 p-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:sticky lg:inset-x-auto lg:bottom-3 lg:rounded-xl lg:bg-ui-surface/95 lg:backdrop-blur"
  >
    <div class="flex items-center gap-3">
      <UiBadge variant="accent">{{ count }} đã chọn</UiBadge>
      <UiButton variant="ghost" size="sm" @click="emit('clear')">Bỏ chọn</UiButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>

    <slot name="note" />
  </div>
</template>
