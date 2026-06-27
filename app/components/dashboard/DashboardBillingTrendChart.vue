<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { BillingTrendEntry } from '~/types/dashboard'
import { useChartTheme } from '~/composables/useChartTheme'
import { formatCurrency, formatCurrencyCompact } from '~/utils/format/currency'

const props = defineProps<{
  trend: BillingTrendEntry[]
}>()

const { stackedColumnOptions, palette } = useChartTheme()

const hasData = computed(() => props.trend.length > 0)

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.trend.map(row => row.period),
  datasets: [
    {
      label: 'Đã thu',
      data: props.trend.map(row => row.paidAmount),
      backgroundColor: palette.successNeon,
      borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
      stack: 'stack0',
    },
    {
      label: 'Chưa thu trong hạn',
      data: props.trend.map(row => Math.max(0, row.outstandingAmount - row.overdueAmount)),
      backgroundColor: palette.warning,
      borderRadius: 0,
      stack: 'stack0',
    },
    {
      label: 'Quá hạn',
      data: props.trend.map(row => row.overdueAmount),
      backgroundColor: palette.errorVivid,
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
      stack: 'stack0',
    },
  ],
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const base = stackedColumnOptions
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
          label: (ctx: TooltipItem<'bar'>) => ` ${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y))}`,
        },
      },
    },
  }
})

const legendItems = computed(() => [
  { label: 'Đã thu', color: palette.successNeon },
  { label: 'Chưa thu trong hạn', color: palette.warning },
  { label: 'Quá hạn', color: palette.errorVivid },
])
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span v-for="item in legendItems" :key="item.label" class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-sm" :style="{ background: item.color }" />
        {{ item.label }}
      </span>
    </div>
    <div class="flex-1">
      <UiEmptyState
        v-if="!hasData"
        title="Chưa có dữ liệu billing"
        description="Khi phát hành hóa đơn, biểu đồ sẽ hiển thị tại đây."
      />
      <ClientOnly v-else>
        <div class="relative h-64 w-full">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
        <template #fallback>
          <div class="h-64 w-full animate-pulse rounded-xl bg-dark-border/50" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
