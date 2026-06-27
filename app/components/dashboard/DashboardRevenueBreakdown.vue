<script setup lang="ts">
import type { RevenueBreakdown } from '~/types/dashboard'
import { formatCurrency } from '~/utils/format/currency'
import {
  REVENUE_CATEGORY_COLOR,
  REVENUE_CATEGORY_LABEL,
} from '~/utils/constants/revenue-categories'

const props = defineProps<{
  breakdown: RevenueBreakdown
}>()

const hasData = computed(() => props.breakdown.categories.length > 0 && props.breakdown.totalIssued > 0)

const categoryRows = computed(() => {
  const total = props.breakdown.totalIssued
  return [...props.breakdown.categories]
    .sort((a, b) => b.amount - a.amount)
    .map((entry) => ({
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

const outstandingAmount = computed(() => Math.max(0, props.breakdown.totalIssued - props.breakdown.totalPaid))

function formatShare(share: number): string {
  if (share === 0) return '0%'
  const rounded = Math.round(share)
  if (rounded === 0) return '<1%'
  return `${rounded}%`
}
</script>

<template>
  <div v-if="hasData" class="space-y-4">
    <dl class="grid grid-cols-1 gap-y-1.5 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-2">
      <div class="flex items-baseline justify-between gap-3 sm:block sm:min-w-0">
        <dt class="text-xs uppercase tracking-wide text-muted">Tổng doanh thu</dt>
        <dd class="font-mono text-lg font-semibold tabular-nums text-white sm:mt-1 sm:text-2xl">
          {{ formatCurrency(breakdown.totalIssued) }}
        </dd>
      </div>
      <div class="flex items-baseline justify-between gap-3 sm:block sm:min-w-0">
        <dt class="text-xs uppercase tracking-wide text-muted">
          Đã thu
          <span class="ml-1 font-mono text-success-neon">{{ collectionRate }}%</span>
        </dt>
        <dd class="font-mono text-lg font-semibold tabular-nums text-success-neon sm:mt-1 sm:text-2xl">
          {{ formatCurrency(breakdown.totalPaid) }}
        </dd>
      </div>
      <div class="flex items-baseline justify-between gap-3 sm:block sm:min-w-0">
        <dt class="text-xs uppercase tracking-wide text-muted">Còn lại</dt>
        <dd
          class="font-mono text-lg font-semibold tabular-nums sm:mt-1 sm:text-2xl"
          :class="outstandingAmount > 0 ? 'text-warning' : 'text-muted'"
        >
          {{ formatCurrency(outstandingAmount) }}
        </dd>
      </div>
    </dl>

    <div class="flex h-1.5 overflow-hidden rounded-full bg-dark-border">
      <div
        v-for="segment in segments"
        :key="segment.key"
        :style="{ width: `${segment.share}%`, background: segment.color }"
        class="h-full"
      />
    </div>

    <ul class="divide-y divide-dark-border rounded-lg border border-dark-border">
      <li
        v-for="row in categoryRows"
        :key="row.key"
        class="grid grid-cols-[1rem_minmax(0,1fr)_auto_3rem] items-center gap-3 px-3 py-2 text-sm"
      >
        <span
          class="inline-block h-2.5 w-2.5 rounded-sm"
          :style="{ background: row.color }"
        />
        <span class="min-w-0 truncate text-white">{{ row.label }}</span>
        <span class="font-mono tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
        <span class="text-right font-mono text-xs tabular-nums text-muted">{{ formatShare(row.share) }}</span>
      </li>
    </ul>
  </div>
</template>

