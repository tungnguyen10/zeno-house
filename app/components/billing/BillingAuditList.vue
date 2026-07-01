<script setup lang="ts">
import type { BillingAuditEvent } from '~/types/billing'
import { groupAuditEvents } from '~/utils/billing/audit-grouping'

const props = defineProps<{
  events: BillingAuditEvent[]
  loading: boolean
  loadingMore?: boolean
  hasMore?: boolean
}>()

defineEmits<{
  (e: 'loadMore'): void
  (e: 'filterCorrelation', id: string): void
}>()

const groups = computed(() => groupAuditEvents(props.events))
</script>

<template>
  <div>
    <!-- Loading skeleton -->
    <div v-if="loading && events.length === 0" class="space-y-4 py-2">
      <UiSkeleton v-for="i in 6" :key="i" class="h-16 w-full" />
    </div>

    <!-- Empty state -->
    <UiEmptyState
      v-else-if="!loading && events.length === 0"
      title="Chưa có sự kiện nào"
      description="Nhật ký sẽ tự động ghi lại khi có thao tác trong kỳ này."
    />

    <!-- Grouped events -->
    <template v-else>
      <template v-for="group in groups" :key="group.key">
        <!-- Group header -->
        <div class="sticky top-0 z-10 bg-dark-card/90 backdrop-blur-sm border-b border-dark-border py-1.5 px-1 mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted">
            {{ group.label }}
          </span>
        </div>

        <!-- Entries with dividers -->
        <div class="divide-y divide-dark-border">
          <BillingAuditEntry
            v-for="ev in group.events"
            :key="ev.id"
            :event="ev"
            @filter-correlation="$emit('filterCorrelation', $event)"
          />
        </div>
      </template>

      <!-- Pagination: Load more (D9) -->
      <div v-if="hasMore" class="py-4 flex justify-center">
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="loadingMore"
          @click="$emit('loadMore')"
        >
          <IconSpinner v-if="loadingMore" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{{ loadingMore ? 'Đang tải…' : 'Tải thêm' }}</span>
        </UiButton>
      </div>
    </template>
  </div>
</template>
