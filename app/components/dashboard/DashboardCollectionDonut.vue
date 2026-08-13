<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import '~/utils/chart-registration'
import { Doughnut } from 'vue-chartjs'
import { useChartTheme } from '~/composables/useChartTheme'
import { formatCurrency } from '~/utils/format/currency'
import { formatPeriodDisplay } from '~/utils/format/period'

const props = defineProps<{
  collectionRate: number
  paidAmount: number
  invoiceTotal: number
  outstandingAmount: number
  overdueAmount?: number
  period?: string
  previousCollectionRate?: number | null
}>()

const { donutOptions, palette, resolvedTheme } = useChartTheme()

const hasData = computed(() => props.invoiceTotal > 0)

const overdueAmount = computed(() => Math.max(0, props.overdueAmount ?? 0))
const inGraceAmount = computed(() => Math.max(0, props.outstandingAmount - overdueAmount.value))

const ratePct = computed(() => Math.round((props.collectionRate || 0) * 100))
const percentLabel = computed(() => `${ratePct.value}%`)

const rateColorClass = computed(() => {
  if (!hasData.value) return 'text-ui-muted'
  if (ratePct.value >= 90) return 'text-status-success'
  if (ratePct.value >= 60) return 'text-status-warning'
  return 'text-status-danger'
})

const periodLabel = computed(() => formatPeriodDisplay(props.period) ?? '')

const deltaPct = computed<number | null>(() => {
  if (!hasData.value) return null
  if (props.previousCollectionRate == null) return null
  const prev = Math.round(props.previousCollectionRate * 100)
  return ratePct.value - prev
})

const deltaLabel = computed(() => {
  if (deltaPct.value == null) return ''
  if (deltaPct.value === 0) return '±0% vs trước'
  const sign = deltaPct.value > 0 ? '↑' : '↓'
  return `${sign} ${Math.abs(deltaPct.value)}% vs trước`
})

const deltaTextClass = computed(() => {
  if (deltaPct.value == null || deltaPct.value === 0) return 'text-ui-muted'
  return deltaPct.value > 0 ? 'text-status-success' : 'text-status-danger'
})

function share(amount: number): number {
  if (!hasData.value) return 0
  return amount / props.invoiceTotal
}

const paidShare = computed(() => share(props.paidAmount) * 100)
const inGraceShare = computed(() => share(inGraceAmount.value) * 100)
const overdueShare = computed(() => share(overdueAmount.value) * 100)

const chartData = computed<ChartData<'doughnut'>>(() => {
  if (!hasData.value) {
    return {
      labels: ['Trống'],
      datasets: [
        {
          data: [1],
          backgroundColor: [palette.value.border],
          borderWidth: 0,
        },
      ],
    }
  }
  const paid = Math.max(0, props.paidAmount)
  return {
    labels: ['Đã thu', 'Chưa đến hạn', 'Quá hạn'],
    datasets: [
      {
        data: [paid, inGraceAmount.value, overdueAmount.value],
        backgroundColor: [palette.value.success, palette.value.warning, palette.value.danger],
        borderColor: palette.value.surface,
        borderWidth: 1,
        borderRadius: 2,
      },
    ],
  }
})

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  ...donutOptions.value,
  rotation: -90,
  circumference: 360,
  cutout: '70%',
  plugins: {
    ...donutOptions.value.plugins,
    tooltip: hasData.value
      ? {
          enabled: true,
          backgroundColor: palette.value.surface,
          titleColor: palette.value.primary,
          bodyColor: palette.value.muted,
          borderColor: palette.value.border,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            label(ctx) {
              const value = (ctx.parsed as number) ?? 0
              const pct = props.invoiceTotal > 0 ? Math.round((value / props.invoiceTotal) * 100) : 0
              return ` ${formatCurrency(value)} · ${pct}%`
            },
          },
        }
      : { enabled: false },
  },
}))
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="mb-3 flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-ui-primary">Tỷ lệ thu tháng này</h3>
      <span v-if="periodLabel" class="text-xs text-ui-muted tabular-nums">{{ periodLabel }}</span>
    </header>

    <div class="flex items-center gap-3">
      <div class="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
        <ClientOnly>
          <Doughnut :key="resolvedTheme" :data="chartData" :options="chartOptions" />
          <template #fallback>
            <div class="h-full w-full animate-pulse rounded-full bg-ui-border/50" />
          </template>
        </ClientOnly>
        <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="text-xl font-semibold leading-none tabular-nums sm:text-2xl" :class="rateColorClass">
            {{ percentLabel }}
          </span>
          <span
            v-if="deltaLabel"
            class="mt-1 text-[10px] font-medium leading-none tabular-nums"
            :class="deltaTextClass"
          >
            {{ deltaLabel }}
          </span>
        </div>
      </div>

      <dl class="min-w-0 flex-1 space-y-1.5 text-xs">
        <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
          <span class="h-2 w-2 rounded-full bg-status-success" aria-hidden="true" />
          <dt class="truncate text-ui-muted">Đã thu</dt>
          <dd class="font-semibold tabular-nums text-status-success">{{ formatCurrency(paidAmount) }}</dd>
        </div>
        <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
          <span class="h-2 w-2 rounded-full bg-status-warning" aria-hidden="true" />
          <dt class="truncate text-ui-muted">Chưa đến hạn</dt>
          <dd
            class="font-semibold tabular-nums"
            :class="inGraceAmount > 0 ? 'text-status-warning' : 'text-ui-muted'"
          >
            {{ formatCurrency(inGraceAmount) }}
          </dd>
        </div>
        <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
          <span class="h-2 w-2 rounded-full bg-status-danger" aria-hidden="true" />
          <dt class="truncate text-ui-muted">Quá hạn</dt>
          <dd
            class="font-semibold tabular-nums"
            :class="overdueAmount > 0 ? 'text-status-danger' : 'text-ui-muted'"
          >
            {{ formatCurrency(overdueAmount) }}
          </dd>
        </div>
      </dl>
    </div>

    <div
      v-if="hasData"
      class="mt-3 flex h-1.5 overflow-hidden rounded-full bg-ui-border"
      role="img"
      :aria-label="`Đã thu ${Math.round(paidShare)}%, chưa đến hạn ${Math.round(inGraceShare)}%, quá hạn ${Math.round(overdueShare)}%`"
    >
      <div class="bg-status-success transition-[width]" :style="{ width: `${paidShare}%` }" />
      <div class="bg-status-warning transition-[width]" :style="{ width: `${inGraceShare}%` }" />
      <div class="bg-status-danger transition-[width]" :style="{ width: `${overdueShare}%` }" />
    </div>

    <div class="mt-3 flex items-center justify-between gap-3 border-t border-ui-border pt-3 text-xs sm:mt-auto">
      <span class="text-ui-muted">Tổng phát hành</span>
      <span class="font-semibold tabular-nums text-ui-primary">{{ formatCurrency(invoiceTotal) }}</span>
    </div>
  </div>
</template>
