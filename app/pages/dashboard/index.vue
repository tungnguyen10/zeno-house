<script setup lang="ts">

import { useIntervalFn } from '@vueuse/core'
import { formatTimeHHmm } from '~/utils/format/time'
import { formatRelativeTime } from '~/utils/format/relative-time'
import type {
  BillingTrendEntry,
  RevenueBreakdown,
  RevenueCategoryAmounts,
  RevenueCategoryKey,
} from '~/types/dashboard'
import { REVENUE_CATEGORY_ORDER } from '~/utils/constants/revenue-categories'

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

const ALL_BUILDINGS = '__all__'
const selectedBuildingId = ref<string>(ALL_BUILDINGS)

const buildingFilterOptions = computed(() => {
  const buildings = summary.value?.buildingBreakdown ?? []
  return [
    { value: ALL_BUILDINGS, label: `Tất cả tòa nhà (${buildings.length})` },
    ...buildings.map(b => ({ value: b.id, label: b.name })),
  ]
})

watchEffect(() => {
  if (selectedBuildingId.value === ALL_BUILDINGS) return
  const exists = summary.value?.buildingBreakdown.some(b => b.id === selectedBuildingId.value)
  if (!exists) selectedBuildingId.value = ALL_BUILDINGS
})

function projectTrend(entries: BillingTrendEntry[], buildingId: string): BillingTrendEntry[] {
  if (buildingId === ALL_BUILDINGS) return entries
  return entries.map((entry) => {
    const bucket = entry.byBuilding[buildingId]
    if (!bucket) {
      return {
        period: entry.period,
        invoiceTotal: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueAmount: 0,
        categories: { rent: 0, electricity: 0, water: 0, service: 0, other: 0 },
        byBuilding: entry.byBuilding,
      }
    }
    return {
      period: entry.period,
      invoiceTotal: bucket.invoiceTotal,
      paidAmount: bucket.paidAmount,
      outstandingAmount: 0,
      overdueAmount: 0,
      categories: bucket.categories,
      byBuilding: entry.byBuilding,
    }
  })
}

function summarizeBreakdown(entries: BillingTrendEntry[]): RevenueBreakdown {
  let totalIssued = 0
  let totalPaid = 0
  const totals: RevenueCategoryAmounts = { rent: 0, electricity: 0, water: 0, service: 0, other: 0 }
  for (const entry of entries) {
    totalIssued += entry.invoiceTotal
    totalPaid += entry.paidAmount
    for (const key of REVENUE_CATEGORY_ORDER) {
      totals[key] += entry.categories[key] ?? 0
    }
  }
  const categories = REVENUE_CATEGORY_ORDER
    .map((key: RevenueCategoryKey) => ({ key, amount: totals[key] }))
    .filter(entry => entry.amount > 0)
  return { totalIssued, totalPaid, categories }
}

const filteredTrend = computed<BillingTrendEntry[]>(() => {
  if (!summary.value) return []
  return projectTrend(summary.value.billingTrend, selectedBuildingId.value)
})

const filteredBreakdown = computed<RevenueBreakdown>(() => {
  if (selectedBuildingId.value === ALL_BUILDINGS) {
    return summary.value?.revenueBreakdown ?? { totalIssued: 0, totalPaid: 0, categories: [] }
  }
  return summarizeBreakdown(filteredTrend.value)
})

const trendYear = computed(() => {
  const iso = meta.value?.generatedAt
  if (iso) return new Date(iso).getFullYear()
  return new Date().getFullYear()
})

const previousCollectionRate = computed<number | null>(() => {
  if (!summary.value) return null
  const currentPeriod = summary.value.billing.currentMonth.period
  const trend = summary.value.billingTrend
  const idx = trend.findIndex(entry => entry.period === currentPeriod)
  // Walk backwards to find the most recent prior period that actually had invoices.
  const startIdx = idx === -1 ? trend.length - 1 : idx - 1
  for (let i = startIdx; i >= 0; i -= 1) {
    const prev = trend[i]
    if (!prev || prev.invoiceTotal <= 0) continue
    return prev.paidAmount / prev.invoiceTotal
  }
  return null
})
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
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <UiSection class="order-2 lg:order-none lg:col-span-4">
          <UiSkeleton v-if="isLoading" class="h-64 rounded-xl" />
          <DashboardCollectionDonut
            v-else-if="summary"
            :collection-rate="summary.billing.currentMonth.collectionRate"
            :paid-amount="summary.billing.currentMonth.paidAmount"
            :invoice-total="summary.billing.currentMonth.invoiceTotal"
            :outstanding-amount="summary.billing.currentMonth.outstandingAmount"
            :overdue-amount="summary.billing.currentMonth.overdueAmount"
            :period="summary.billing.currentMonth.period"
            :previous-collection-rate="previousCollectionRate"
          />
        </UiSection>

        <div class="order-1 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:order-none lg:col-span-8 lg:gap-6">
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
      <UiSection :title="`Doanh thu năm ${trendYear}`">
        <template v-if="summary && summary.buildingBreakdown.length > 1" #actions>
          <UiSelect
            v-model="selectedBuildingId"
            :options="buildingFilterOptions"
            density="compact"
            aria-label="Lọc theo tòa nhà"
            class="w-56"
          />
        </template>
        <div v-if="isLoading" class="space-y-4">
          <UiSkeleton class="h-20 rounded-xl" />
          <UiSkeleton class="h-64 rounded-xl" />
        </div>
        <template v-else-if="summary">
          <DashboardRevenueBreakdown :breakdown="filteredBreakdown" />
          <div
            v-if="filteredBreakdown.totalIssued > 0"
            class="my-5 border-t border-dark-border"
          />
          <DashboardBillingTrendChart :trend="filteredTrend" />
        </template>
      </UiSection>

      <!-- Detail: occupancy by building + pending operations -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
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
