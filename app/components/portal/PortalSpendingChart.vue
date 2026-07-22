<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import '~/utils/chart-registration'
import { Line } from 'vue-chartjs'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { useChartTheme } from '~/composables/useChartTheme'
import { formatCurrency, formatCurrencyCompact } from '~/utils/format/currency'
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'

const props = defineProps<{
  invoices: TenantInvoiceListItem[]
  /** How many recent periods to show (default 6) */
  limit?: number
  /** Chart canvas height in pixels (default 144) */
  height?: number
}>()

const { palette } = useChartTheme()

const STATUS_COLOR: Record<string, string> = {
  paid: palette.successNeon,
  due: palette.warning,
  overdue: palette.errorVivid,
}

/** Take the N most-recent invoices and reverse to chronological order. */
const recent = computed(() =>
  [...props.invoices].slice(0, props.limit ?? 6).reverse(),
)

const hasData = computed(() => recent.value.length > 0)

const pointColors = computed(() =>
  recent.value.map(inv => STATUS_COLOR[portalInvoiceStatementAccent(inv.status)] ?? palette.muted),
)

const chartData = computed<ChartData<'line'>>(() => ({
  labels: recent.value.map(inv =>
    `${String(inv.periodMonth).padStart(2, '0')}/${String(inv.periodYear).slice(-2)}`,
  ),
  datasets: [
    {
      data: recent.value.map(inv => inv.totalAmount),
      borderColor: palette.cyan,
      borderWidth: 2,
      backgroundColor: `${palette.cyan}18`,
      fill: true,
      tension: 0,
      cubicInterpolationMode: 'monotone' as const,
      pointStyle: 'circle' as const,
      pointBackgroundColor: pointColors.value,
      pointBorderColor: pointColors.value,
      pointBorderWidth: 0,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointHitRadius: 12,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: palette.darkSurface,
      titleColor: palette.white,
      bodyColor: palette.muted,
      borderColor: palette.darkBorder,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: TooltipItem<'line'>) => ` ${formatCurrency(Number(ctx.parsed.y))}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: palette.muted, font: { size: 11 } },
      border: { color: palette.darkBorder },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.darkBorder },
      ticks: {
        color: palette.muted,
        font: { size: 11 },
        maxTicksLimit: 4,
        callback: (value: number | string) => formatCurrencyCompact(Number(value)),
      },
      border: { display: false },
    },
  },
}))

const heightPx = computed(() => `${props.height ?? 144}px`)
</script>

<template>
  <ClientOnly>
    <div v-if="hasData" class="w-full" :style="{ height: heightPx }">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <p v-else class="portal-type-caption py-4 text-center text-body">Chưa có dữ liệu</p>
    <template #fallback>
      <div class="w-full animate-pulse rounded-xl bg-border-light/50" :style="{ height: heightPx }" />
    </template>
  </ClientOnly>
</template>
