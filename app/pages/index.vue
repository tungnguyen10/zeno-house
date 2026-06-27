<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { formatTimeHHmm } from '~/utils/format/time'
import { formatRelativeTime } from '~/utils/format/relative-time'

definePageMeta({
  title: 'Dashboard',
})

const { summary, meta, isLoading, error, errorCode, refresh } = useDashboardSummary()

const isForbidden = computed(() => errorCode.value === 'FORBIDDEN')
const hasError = computed(() => Boolean(error.value) && !isForbidden.value)

const tick = ref(Date.now())
useIntervalFn(() => { tick.value = Date.now() }, 30_000)

const relativeLabel = computed(() => {
  if (!meta.value?.generatedAt) return ''
  // reference tick so label refreshes on the interval
  void tick.value
  return formatRelativeTime(meta.value.generatedAt, new Date())
})

const absoluteLabel = computed(() =>
  meta.value?.generatedAt ? formatTimeHHmm(meta.value.generatedAt) : '',
)

async function handleRefresh() {
  await refresh()
  tick.value = Date.now()
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader title="Dashboard" description="Tổng quan vận hành nhà cho thuê">
      <template #actions>
        <div class="flex items-center gap-3">
          <span
            v-if="relativeLabel"
            :title="absoluteLabel"
            class="text-xs text-muted"
          >
            {{ relativeLabel }}
          </span>
          <UiButton
            variant="ghost"
            size="sm"
            icon-only
            aria-label="Tải lại dashboard"
            :loading="isLoading"
            @click="handleRefresh"
          >
            <IconRefresh class="h-4 w-4" />
          </UiButton>
        </div>
      </template>
    </UiPageHeader>

    <UiAlert v-if="isForbidden" severity="warning" title="Không có quyền">
      Bạn không có quyền xem dashboard. Vui lòng liên hệ quản trị viên.
    </UiAlert>

    <UiAlert v-else-if="hasError" severity="danger" title="Lỗi tải dữ liệu">
      <div class="flex items-start justify-between gap-3">
        <span>{{ error }}</span>
        <UiButton variant="secondary" size="sm" :loading="isLoading" @click="handleRefresh">
          Thử lại
        </UiButton>
      </div>
    </UiAlert>

    <template v-else>
      <!-- Hero row: Collection donut + KPI strip -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <UiSection class="lg:col-span-5">
          <UiSkeleton v-if="isLoading" class="h-64 rounded-xl" />
          <DashboardCollectionDonut
            v-else-if="summary"
            :collection-rate="summary.billing.currentMonth.collectionRate"
            :paid-amount="summary.billing.currentMonth.paidAmount"
            :invoice-total="summary.billing.currentMonth.invoiceTotal"
            :outstanding-amount="summary.billing.currentMonth.outstandingAmount"
          />
        </UiSection>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
          <UiSection title="Phòng">
            <UiSkeleton v-if="isLoading" class="h-40 rounded-xl" />
            <DashboardRoomsSummaryCard
              v-else-if="summary"
              :rooms="summary.rooms"
              :building-count="summary.buildings.total"
            />
          </UiSection>

          <UiSection title="Hợp đồng">
            <UiSkeleton v-if="isLoading" class="h-40 rounded-xl" />
            <DashboardContractsSummaryCard
              v-else-if="summary"
              :active="summary.contracts.active"
              :expiring-soon="summary.contracts.expiringSoon"
              :expiring-urgent="summary.contracts.expiringUrgent"
              :tenant-count="summary.tenants.total"
            />
          </UiSection>
        </div>
      </div>

      <!-- Trend chart -->
      <UiSection title="Thu / Công nợ 6 kỳ gần nhất">
        <UiSkeleton v-if="isLoading" class="h-64 rounded-xl" />
        <DashboardBillingTrendChart v-else-if="summary" :trend="summary.billingTrend" />
      </UiSection>

      <!-- Detail: occupancy by building + pending operations -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <UiSection title="Tỷ lệ phòng theo tòa">
          <div v-if="isLoading" class="space-y-3">
            <UiSkeleton v-for="i in 3" :key="i" class="h-16 rounded-lg" />
          </div>
          <DashboardOccupancyList v-else-if="summary" :buildings="summary.buildingBreakdown" />
        </UiSection>

        <UiSection title="Việc cần xử lý">
          <div v-if="isLoading" class="space-y-2">
            <UiSkeleton v-for="i in 3" :key="i" class="h-12 rounded-lg" />
          </div>
          <DashboardPendingList v-else-if="summary" :items="summary.pendingOperations" />
        </UiSection>
      </div>
    </template>
  </div>
</template>
