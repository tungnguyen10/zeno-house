<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import '~/utils/chart-registration'
import { Line } from 'vue-chartjs'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { usePortalChartTheme } from '~/composables/tenant-portal/usePortalChartTheme'
import { formatCurrency, formatCurrencyCompact } from '~/utils/format/currency'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

const props = defineProps<{
  invoices: TenantInvoiceListItem[]
  /** How many recent periods to show (default 6) */
  limit?: number
  /** Chart canvas height in pixels (default 144) */
  height?: number
}>()

const overview = computed(() =>
  buildPortalFinancialOverview(props.invoices, props.limit ?? 6),
)
const { palette, animationDuration } = usePortalChartTheme()

const hasData = computed(() => overview.value.invoices.length > 0)

const chartData = computed<ChartData<'line'>>(() => ({
  labels: overview.value.labels,
  datasets: [
    {
      label: 'Tổng hóa đơn',
      data: overview.value.totalAmounts,
      borderColor: palette.value.accent,
      borderWidth: 2,
      backgroundColor: palette.value.accentSoft,
      fill: true,
      tension: 0.28,
      pointBackgroundColor: palette.value.accent,
      pointBorderColor: palette.value.accent,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointHitRadius: 12,
    },
    {
      label: 'Đã thanh toán',
      data: overview.value.paidAmounts,
      borderColor: palette.value.positive,
      borderWidth: 2,
      borderDash: [5, 4],
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.28,
      pointBackgroundColor: palette.value.positive,
      pointBorderColor: palette.value.positive,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointHitRadius: 12,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: animationDuration.value },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: palette.value.surfaceDeep,
      titleColor: palette.value.title,
      bodyColor: palette.value.body,
      borderColor: palette.value.border,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: TooltipItem<'line'>) =>
          `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y))}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: palette.value.muted, font: { size: 11 } },
      border: { color: palette.value.border },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.value.border },
      ticks: {
        color: palette.value.muted,
        font: { size: 11 },
        maxTicksLimit: 4,
        callback: (value: number | string) => formatCurrencyCompact(Number(value)),
      },
      border: { display: false },
    },
  },
}))

const heightPx = computed(() => `${props.height ?? 144}px`)
const chartSummary = computed(() => {
  const first = overview.value.labels[0]
  const last = overview.value.labels.at(-1)
  if (!first || !last) return ''

  return `${first} đến ${last}: tổng hóa đơn và số tiền đã thanh toán theo từng kỳ.`
})
</script>

<template>
  <ClientOnly>
    <div v-if="hasData" class="w-full">
      <div aria-hidden="true" :style="{ height: heightPx }">
        <Line :data="chartData" :options="chartOptions" />
      </div>
      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border-light pt-3">
        <span class="portal-type-caption inline-flex items-center gap-2 text-body">
          <span class="h-0.5 w-5 rounded-full bg-theme" aria-hidden="true" />
          Tổng hóa đơn
        </span>
        <span class="portal-type-caption inline-flex items-center gap-2 text-body">
          <span class="w-5 border-t-2 border-dashed border-portal-positive" aria-hidden="true" />
          Đã thanh toán
        </span>
      </div>
      <p data-test="chart-summary" class="sr-only">{{ chartSummary }}</p>
    </div>
    <p v-else class="portal-type-caption py-4 text-center text-body">Chưa có dữ liệu</p>
    <template #fallback>
      <div class="w-full animate-pulse rounded-xl bg-border-light/50" :style="{ height: heightPx }" />
    </template>
  </ClientOnly>
</template>
