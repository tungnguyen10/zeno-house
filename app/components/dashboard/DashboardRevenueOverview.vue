<script setup lang="ts">
import type { BillingTrendEntry, RevenueBreakdown } from '~/types/dashboard'
import { useChartTheme } from '~/composables/useChartTheme'
import { formatCurrency } from '~/utils/format/currency'
import { REVENUE_CATEGORY_LABEL } from '~/utils/constants/revenue-categories'

const props = defineProps<{
  breakdown: RevenueBreakdown
  trend: BillingTrendEntry[]
  currentPeriod?: string
}>()

const { palette } = useChartTheme()

const categoryRows = computed(() => {
  const total = props.breakdown.totalIssued
  return [...props.breakdown.categories]
    .sort((a, b) => b.amount - a.amount)
    .map(entry => ({
      key: entry.key,
      label: REVENUE_CATEGORY_LABEL[entry.key],
      color: palette.value.categories[entry.key],
      amount: entry.amount,
      share: total === 0 ? 0 : (entry.amount / total) * 100,
    }))
})

const collectionRate = computed(() => {
  if (props.breakdown.totalIssued === 0) return 0
  return Math.round((props.breakdown.totalPaid / props.breakdown.totalIssued) * 100)
})

const outstandingAmount = computed(() =>
  Math.max(0, props.breakdown.totalIssued - props.breakdown.totalPaid),
)

function formatShare(share: number): string {
  if (share === 0) return '0%'
  const rounded = Math.round(share)
  return rounded === 0 ? '<1%' : `${rounded}%`
}
</script>

<template>
  <div class="space-y-5">
    <dl data-revenue-summary class="grid grid-cols-2 gap-x-4 sm:grid-cols-3 sm:gap-x-6">
      <div class="col-span-2 min-w-0 sm:col-span-1">
        <dt class="text-xs uppercase tracking-wide text-ui-muted">Tổng doanh thu</dt>
        <dd class="mt-1 text-2xl font-semibold tabular-nums text-ui-primary">
          {{ formatCurrency(breakdown.totalIssued) }}
        </dd>
      </div>
      <div class="mt-3 min-w-0 border-t border-ui-border pt-3 sm:mt-0 sm:border-0 sm:pt-0">
        <dt class="text-xs uppercase tracking-wide text-ui-muted">
          Đã thu
          <span class="ml-1 tabular-nums text-status-success">{{ collectionRate }}%</span>
        </dt>
        <dd class="mt-1 truncate text-base font-semibold tabular-nums text-status-success sm:text-2xl">
          {{ formatCurrency(breakdown.totalPaid) }}
        </dd>
      </div>
      <div class="mt-3 min-w-0 border-t border-ui-border pt-3 sm:mt-0 sm:border-0 sm:pt-0">
        <dt class="text-xs uppercase tracking-wide text-ui-muted">Còn lại</dt>
        <dd
          class="mt-1 truncate text-base font-semibold tabular-nums sm:text-2xl"
          :class="outstandingAmount > 0 ? 'text-status-warning' : 'text-ui-muted'"
        >
          {{ formatCurrency(outstandingAmount) }}
        </dd>
      </div>
    </dl>

    <div
      data-revenue-grid
      class="grid grid-cols-1 gap-5 border-t border-ui-border pt-5 lg:grid-cols-[minmax(17rem,1fr)_minmax(0,2.5fr)] lg:items-stretch"
    >
      <ul v-if="categoryRows.length" class="divide-y divide-ui-border rounded-lg border border-ui-border lg:flex lg:flex-col">
        <li
          v-for="row in categoryRows"
          :key="row.key"
          class="grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm sm:grid-cols-[0.625rem_minmax(0,1fr)_auto_3rem] lg:flex-1"
        >
          <span class="row-span-2 inline-block h-2.5 w-2.5 rounded-sm sm:row-span-1" :style="{ background: row.color }" aria-hidden="true" />
          <span class="row-span-2 min-w-0 whitespace-nowrap text-ui-primary sm:row-span-1">{{ row.label }}</span>
          <span class="whitespace-nowrap text-right tabular-nums text-ui-primary">{{ formatCurrency(row.amount) }}</span>
          <span
            :data-category-share="row.key"
            class="col-start-3 text-right text-xs tabular-nums text-ui-muted sm:col-start-auto"
          >
            {{ formatShare(row.share) }}
          </span>
        </li>
      </ul>
      <div v-else class="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-ui-border px-4 text-center text-xs text-ui-muted">
        Chưa có cơ cấu doanh thu trong năm nay.
      </div>

      <div class="min-w-0">
        <DashboardBillingTrendChart :trend="trend" :current-period="currentPeriod" />
      </div>
    </div>
  </div>
</template>
