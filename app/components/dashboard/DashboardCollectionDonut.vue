<script setup lang="ts">
import type { ChartData } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { useChartTheme, chartCenterTextPlugin } from '~/composables/useChartTheme'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  collectionRate: number
  paidAmount: number
  invoiceTotal: number
  outstandingAmount: number
}>()

const { donutOptions, palette } = useChartTheme()

const hasData = computed(() => props.invoiceTotal > 0)

const percentLabel = computed(() => `${Math.round((props.collectionRate || 0) * 100)}%`)

const captionLabel = computed(() => {
  if (!hasData.value) return 'Chưa phát hành hoá đơn tháng này'
  return `${formatCurrency(props.paidAmount)} / ${formatCurrency(props.invoiceTotal)}`
})

const chartData = computed<ChartData<'doughnut'>>(() => {
  const paid = Math.max(0, props.paidAmount)
  const remaining = Math.max(0, props.invoiceTotal - props.paidAmount)
  return {
    labels: ['Đã thu', 'Còn lại'],
    datasets: [
      {
        data: hasData.value ? [paid, remaining] : [0, 1],
        backgroundColor: hasData.value
          ? [palette.cyan, palette.darkBorder]
          : [palette.darkBorder, palette.darkBorder],
        borderWidth: 0,
        borderRadius: 4,
      },
    ],
  }
})

const centerPlugin = chartCenterTextPlugin(() => ({
  primary: percentLabel.value,
  secondary: hasData.value ? captionLabel.value : '',
}))

const outstandingLabel = computed(() => formatCurrency(props.outstandingAmount))
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex items-baseline justify-between">
      <h3 class="text-sm font-semibold text-white">Tỷ lệ thu tháng này</h3>
      <span class="text-xs text-muted">Collection rate</span>
    </div>
    <div class="relative flex-1">
      <ClientOnly>
        <div class="relative h-48 w-full">
          <Doughnut :data="chartData" :options="donutOptions" :plugins="[centerPlugin]" />
        </div>
        <template #fallback>
          <div class="h-48 w-full animate-pulse rounded-xl bg-dark-border/50" />
        </template>
      </ClientOnly>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-3 border-t border-dark-border pt-3 text-xs">
      <div>
        <div class="text-muted">Còn lại</div>
        <div class="font-semibold text-error-vivid">{{ outstandingLabel }}</div>
      </div>
      <div class="text-right">
        <div class="text-muted">Đã phát hành</div>
        <div class="font-semibold text-white">{{ formatCurrency(invoiceTotal) }}</div>
      </div>
    </div>
  </div>
</template>
