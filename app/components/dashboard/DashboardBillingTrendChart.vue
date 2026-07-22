<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import '~/utils/chart-registration'
import { Line } from 'vue-chartjs'
import type { BillingTrendEntry, RevenueCategoryKey } from '~/types/dashboard'
import { useChartTheme } from '~/composables/useChartTheme'
import { formatCurrency, formatCurrencyCompact } from '~/utils/format/currency'
import {
  REVENUE_CATEGORY_COLOR,
  REVENUE_CATEGORY_LABEL,
  REVENUE_CATEGORY_ORDER,
} from '~/utils/constants/revenue-categories'

const props = defineProps<{
  trend: BillingTrendEntry[]
}>()

const { stackedAreaOptions } = useChartTheme()

const hasData = computed(() => props.trend.some(row => row.invoiceTotal > 0))

function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${value}`
}

const visibleCategories = computed<RevenueCategoryKey[]>(() =>
  REVENUE_CATEGORY_ORDER.filter(key => props.trend.some(row => (row.categories?.[key] ?? 0) > 0)),
)

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.trend.map(row => row.period),
  datasets: visibleCategories.value.map(key => ({
    label: REVENUE_CATEGORY_LABEL[key],
    data: props.trend.map(row => row.categories?.[key] ?? 0),
    borderColor: REVENUE_CATEGORY_COLOR[key],
    backgroundColor: withAlpha(REVENUE_CATEGORY_COLOR[key], 0.35),
    pointBackgroundColor: REVENUE_CATEGORY_COLOR[key],
    pointBorderColor: REVENUE_CATEGORY_COLOR[key],
    fill: true,
    stack: 'revenue',
  })),
}))

const chartOptions = computed<ChartOptions<'line'>>(() => {
  const base = stackedAreaOptions
  return {
    ...base,
    scales: {
      ...base.scales,
      y: {
        ...base.scales?.y,
        ticks: {
          ...base.scales?.y?.ticks,
          callback: (value) => formatCurrencyCompact(Number(value)),
        },
      },
    },
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => ` ${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y))}`,
          footer: (items: TooltipItem<'line'>[]) => {
            const total = items.reduce((sum, item) => sum + Number(item.parsed.y), 0)
            return `Tổng: ${formatCurrency(total)}`
          },
        },
      },
    },
  }
})
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1">
      <UiEmptyState
        v-if="!hasData"
        title="Chưa có dữ liệu doanh thu"
        description="Khi phát hành hóa đơn, biểu đồ sẽ hiển thị tại đây."
      />
      <ClientOnly v-else>
        <div class="relative h-64 w-full">
          <Line :data="chartData" :options="chartOptions" />
        </div>
        <template #fallback>
          <div class="h-64 w-full animate-pulse rounded-xl bg-dark-border/50" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
