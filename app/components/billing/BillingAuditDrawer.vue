<script setup lang="ts">
import type { BillingAuditFilters } from '~/composables/billing/useBillingAuditList'
import { useBillingAuditList } from '~/composables/billing/useBillingAuditList'

const props = defineProps<{
  open: boolean
  periodId: string
  /** Period label for CSV filename (e.g. "05-2026"). */
  periodLabel?: string
  /** Known contributors for actor filter chips. */
  contributors?: { id: string; name: string | null; email: string | null }[]
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const {
  filters,
  events,
  loading,
  loadingMore,
  total,
  hasMore,
  load,
  loadMore,
  resetFilters,
  filterByCorrelation,
} = useBillingAuditList(() => props.periodId)

// Load on first open, reload when re-opened
watch(() => props.open, async (open) => {
  if (open && events.value.length === 0) await load()
})

function handleUpdateFilters(next: BillingAuditFilters) {
  Object.assign(filters, next)
}

function handleReset() {
  resetFilters()
}

function handleFilterCorrelation(id: string) {
  filterByCorrelation(id)
}
</script>

<template>
  <UiDrawer
    :model-value="open"
    title="Nhật ký kỳ vận hành"
    width="w-full sm:w-[48rem]"
    @update:model-value="$emit('update:open', $event)"
  >
    <div class="flex flex-col gap-4 h-full overflow-hidden">
      <!-- Filter bar -->
      <div class="flex-none px-1">
        <BillingAuditFilterBar
          :filters="filters"
          :total="total"
          :loading="loading"
          :has-more="hasMore"
          :contributors="contributors"
          :period-label="periodLabel"
          :events="events"
          @update:filters="handleUpdateFilters"
          @reset="handleReset"
          @refresh="load"
        />
      </div>

      <!-- Event list -->
      <div class="flex-1 overflow-y-auto -mx-1 px-1">
        <BillingAuditList
          :events="events"
          :loading="loading"
          :loading-more="loadingMore"
          :has-more="hasMore"
          @load-more="loadMore"
          @filter-correlation="handleFilterCorrelation"
        />
      </div>
    </div>
  </UiDrawer>
</template>
