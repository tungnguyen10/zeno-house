<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import '~/utils/chart-registration'
import { Doughnut } from 'vue-chartjs'
import type { PortalStatementAccent } from '~/utils/constants/portal-status'
import { useChartTheme } from '~/composables/useChartTheme'

const props = defineProps<{
  paidAmount: number
  totalAmount: number
  accent: PortalStatementAccent
  /** Diameter in Tailwind size units (default 14 = 3.5rem / 56px) */
  size?: number
}>()

const { palette } = useChartTheme()

const ACCENT_COLOR: Record<PortalStatementAccent, string> = {
  paid: palette.successNeon,
  due: palette.warning,
  overdue: palette.errorVivid,
}

const accentColor = computed(() => ACCENT_COLOR[props.accent])

const pct = computed(() =>
  props.totalAmount > 0
    ? Math.min(100, Math.round((props.paidAmount / props.totalAmount) * 100))
    : 0,
)

const trackColor = computed(() => `${accentColor.value}1A`)

const chartData = computed<ChartData<'doughnut'>>(() => ({
  datasets: [
    {
      data: [props.paidAmount, Math.max(0, props.totalAmount - props.paidAmount)],
      backgroundColor: [accentColor.value, trackColor.value],
      borderWidth: 0,
      hoverOffset: 0,
    },
  ],
}))

const chartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  animation: { duration: 220 },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
}

const sizeClass = computed(() => {
  const n = props.size ?? 14
  return `h-${n} w-${n}`
})
</script>

<template>
  <ClientOnly>
    <div class="relative shrink-0" :class="sizeClass">
      <Doughnut :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="portal-type-caption font-bold tabular-nums" :style="{ color: accentColor }">
          {{ pct }}%
        </span>
      </div>
    </div>
    <template #fallback>
      <div class="shrink-0 animate-pulse rounded-full bg-border-light/50" :class="sizeClass" />
    </template>
  </ClientOnly>
</template>
