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

const occupancyPercent = computed(() => {
  const rooms = summary.value?.rooms
  if (!rooms || rooms.total === 0) return 0
  return Math.round((rooms.occupied / rooms.total) * 100)
})

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
            <UiSkeleton v-if="isLoading" class="h-28 rounded-xl" />
            <template v-else-if="summary">
              <div class="flex flex-col gap-1">
                <p class="text-xs uppercase tracking-wide text-muted">Occupancy</p>
                <p class="text-2xl font-semibold tabular-nums text-cyan">{{ occupancyPercent }}%</p>
                <p class="text-xs text-muted">
                  {{ summary.rooms.occupied }}/{{ summary.rooms.total }} đang thuê
                </p>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span class="text-muted">Trống</span>
                  <p class="font-semibold tabular-nums text-success-neon">{{ summary.rooms.available }}</p>
                </div>
                <div>
                  <span class="text-muted">Bảo trì</span>
                  <p class="font-semibold tabular-nums text-warning">{{ summary.rooms.maintenance }}</p>
                </div>
                <div>
                  <span class="text-muted">Tổng tòa</span>
                  <p class="font-semibold tabular-nums text-white">{{ summary.buildings.total }}</p>
                </div>
              </div>
            </template>
          </UiSection>

          <UiSection title="Hợp đồng">
            <UiSkeleton v-if="isLoading" class="h-28 rounded-xl" />
            <template v-else-if="summary">
              <div class="flex flex-col gap-1">
                <p class="text-xs uppercase tracking-wide text-muted">Active</p>
                <p class="text-2xl font-semibold tabular-nums text-white">{{ summary.contracts.active }}</p>
                <p class="text-xs text-muted">{{ summary.tenants.total }} khách thuê</p>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-muted">Hết hạn ≤30 ngày</span>
                  <p class="font-semibold tabular-nums text-warning">{{ summary.contracts.expiringSoon }}</p>
                </div>
                <div>
                  <span class="text-muted">≤7 ngày (urgent)</span>
                  <p
                    class="font-semibold tabular-nums"
                    :class="summary.contracts.expiringUrgent > 0 ? 'text-error-vivid' : 'text-muted'"
                  >
                    {{ summary.contracts.expiringUrgent }}
                  </p>
                </div>
              </div>
            </template>
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
        <UiSection title="Occupancy theo tòa">
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
