<script setup lang="ts">
import type { BillingTrendEntry, RevenueBreakdown } from '~/types/dashboard'
import { formatCurrency } from '~/utils/format/currency'
import {
  REVENUE_CATEGORY_COLOR,
  REVENUE_CATEGORY_LABEL,
} from '~/utils/constants/revenue-categories'

const props = defineProps<{
  breakdown: RevenueBreakdown
  trend: BillingTrendEntry[]
}>()

const categoryRows = computed(() => {
  const total = props.breakdown.totalIssued
  return [...props.breakdown.categories]
    .sort((a, b) => b.amount - a.amount)
    .map(entry => ({
      key: entry.key,
      label: REVENUE_CATEGORY_LABEL[entry.key],
      color: REVENUE_CATEGORY_COLOR[entry.key],
      amount: entry.amount,
      share: total === 0 ? 0 : (entry.amount / total) * 100,
    }))
})

const segments = computed(() => categoryRows.value.filter(row => row.share > 0))

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
    <dl data-revenue-summary class="grid grid-cols-1 gap-y-2 sm:grid-cols-3 sm:gap-x-6">
      <div class="flex min-w-0 items-baseline justify-between gap-3 sm:block">
        <dt class="text-xs uppercase tracking-wide text-muted">Tổng doanh thu</dt>
        <dd class="text-lg font-semibold tabular-nums text-white sm:mt-1 sm:text-2xl">
          {{ formatCurrency(breakdown.totalIssued) }}
        </dd>
      </div>
      <div class="flex min-w-0 items-baseline justify-between gap-3 sm:block">
        <dt class="text-xs uppercase tracking-wide text-muted">
          Đã thu
          <span class="ml-1 tabular-nums text-success-neon">{{ collectionRate }}%</span>
        </dt>
        <dd class="text-lg font-semibold tabular-nums text-success-neon sm:mt-1 sm:text-2xl">
          {{ formatCurrency(breakdown.totalPaid) }}
        </dd>
      </div>
      <div class="flex min-w-0 items-baseline justify-between gap-3 sm:block">
        <dt class="text-xs uppercase tracking-wide text-muted">Còn lại</dt>
        <dd
          class="text-lg font-semibold tabular-nums sm:mt-1 sm:text-2xl"
          :class="outstandingAmount > 0 ? 'text-warning' : 'text-muted'"
        >
          {{ formatCurrency(outstandingAmount) }}
        </dd>
      </div>
    </dl>

    <div class="flex h-1.5 overflow-hidden rounded-full bg-dark-border" role="img" aria-label="Tỷ trọng doanh thu theo nhóm">
      <div
        v-for="segment in segments"
        :key="segment.key"
        class="h-full"
        :style="{ width: `${segment.share}%`, background: segment.color }"
      />
    </div>

    <div
      data-revenue-grid
      class="grid grid-cols-1 gap-5 border-t border-dark-border pt-5 lg:grid-cols-[minmax(15rem,3fr)_minmax(0,7fr)] lg:items-stretch"
    >
      <ul v-if="categoryRows.length" class="divide-y divide-dark-border rounded-lg border border-dark-border">
        <li
          v-for="row in categoryRows"
          :key="row.key"
          class="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm sm:grid-cols-[1rem_minmax(0,1fr)_auto_3rem]"
        >
          <span class="inline-block h-2.5 w-2.5 rounded-sm" :style="{ background: row.color }" aria-hidden="true" />
          <span class="min-w-0 truncate text-white">{{ row.label }}</span>
          <span class="whitespace-nowrap text-xs tabular-nums text-white sm:text-sm">{{ formatCurrency(row.amount) }}</span>
          <span
            :data-category-share="row.key"
            class="col-start-2 text-xs tabular-nums text-muted sm:col-start-auto sm:text-right"
          >
            {{ formatShare(row.share) }}
          </span>
        </li>
      </ul>
      <div v-else class="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-dark-border px-4 text-center text-xs text-muted">
        Chưa có cơ cấu doanh thu trong năm nay.
      </div>

      <div class="min-w-0">
        <DashboardBillingTrendChart :trend="trend" />
      </div>
    </div>
  </div>
</template>
