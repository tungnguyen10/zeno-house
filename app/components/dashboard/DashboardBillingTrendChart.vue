<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import '~/utils/chart-registration'
import { Bar } from 'vue-chartjs'
import type { BillingTrendEntry, RevenueCategoryKey } from '~/types/dashboard'
import { useChartTheme } from '~/composables/useChartTheme'
import { formatCurrency, formatCurrencyCompact } from '~/utils/format/currency'
import {
  REVENUE_CATEGORY_LABEL,
  REVENUE_CATEGORY_ORDER,
} from '~/utils/constants/revenue-categories'

const props = defineProps<{
  trend: BillingTrendEntry[]
  currentPeriod?: string
}>()

const { stackedColumnOptions, palette, resolvedTheme } = useChartTheme()

const hasData = computed(() => props.trend.some(row => row.invoiceTotal > 0))

const visibleCategories = computed<RevenueCategoryKey[]>(() =>
  REVENUE_CATEGORY_ORDER.filter(key => props.trend.some(row => (row.categories?.[key] ?? 0) > 0)),
)

function isFuture(period: string): boolean {
  return props.currentPeriod !== undefined && period > props.currentPeriod
}

const chartData = computed<ChartData<'bar', (number | null)[]>>(() => {
  const keys = visibleCategories.value
  return {
    labels: props.trend.map(row => row.period),
    datasets: keys.map((key, index) => ({
      label: REVENUE_CATEGORY_LABEL[key],
      data: props.trend.map(row => (isFuture(row.period) ? null : row.categories?.[key] ?? 0)),
      backgroundColor: palette.value.categories[key],
      hoverBackgroundColor: palette.value.categories[key],
      borderRadius: index === keys.length - 1 ? { topLeft: 3, topRight: 3 } : 0,
      borderSkipped: false,
      maxBarThickness: 28,
      stack: 'revenue',
    })),
  }
})

const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const base = stackedColumnOptions.value
  return {
    ...base,
    scales: {
      ...base.scales,
      x: {
        ...base.scales?.x,
        ticks: {
          ...base.scales?.x?.ticks,
          maxRotation: 0,
          autoSkipPadding: 8,
          callback: (_: unknown, i: number) => {
            const period = props.trend[i]?.period ?? ''
            const month = period.split('-')[1]
            return month ? `Th.${Number(month)}` : period
          },
        },
      },
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
        filter: (item: TooltipItem<'bar'>) => item.parsed.y !== null,
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => ` ${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y))}`,
          footer: (items: TooltipItem<'bar'>[]) => {
            const total = items.reduce((sum, item) => sum + Number(item.parsed.y ?? 0), 0)
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
          <Bar :key="resolvedTheme" :data="chartData" :options="chartOptions" />
        </div>
        <template #fallback>
          <div class="h-64 w-full animate-pulse rounded-xl bg-ui-border/50" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
