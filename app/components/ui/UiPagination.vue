<script setup lang="ts">
/**
 * Shared list-footer pagination. The prev/next controls are dropped entirely
 * on single-page results so the footer never renders dead disabled chrome —
 * the result summary still shows, since the count stays useful on its own.
 */
const props = defineProps<{
  page: number
  totalPages: number
  /** Result summary, e.g. "43 kết quả". Shown before the page indicator. */
  totalLabel?: string
}>()

const emit = defineEmits<{
  'update:page': [value: number]
}>()

const hasPages = computed(() => props.totalPages > 1)

function go(next: number) {
  const target = Math.min(Math.max(next, 1), props.totalPages)
  if (target !== props.page) emit('update:page', target)
}
</script>

<template>
  <div
    v-if="totalLabel || hasPages"
    class="mt-6 flex items-center justify-between gap-3 border-t border-ui-border pt-4"
  >
    <p class="min-w-0 truncate text-sm text-ui-muted">
      <span v-if="totalLabel">{{ totalLabel }}</span>
      <span v-if="totalLabel && hasPages" aria-hidden="true"> · </span>
      <span v-if="hasPages" class="tabular-nums">Trang {{ page }}/{{ totalPages }}</span>
    </p>

    <nav v-if="hasPages" class="flex shrink-0 items-center gap-1" aria-label="Phân trang">
      <UiButton
        variant="secondary"
        size="sm"
        icon-only
        class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
        :disabled="page <= 1"
        aria-label="Trang trước"
        @click="go(page - 1)"
      >
        <IconChevronLeft class="h-4 w-4" aria-hidden="true" />
      </UiButton>
      <UiButton
        variant="secondary"
        size="sm"
        icon-only
        class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
        :disabled="page >= totalPages"
        aria-label="Trang sau"
        @click="go(page + 1)"
      >
        <IconChevronRight class="h-4 w-4" aria-hidden="true" />
      </UiButton>
    </nav>
  </div>
</template>
