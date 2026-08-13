import type { ChartOptions, Plugin } from 'chart.js'
import { computed } from 'vue'
import { useDashboardTheme, type DashboardResolvedTheme } from './useDashboardTheme'

export interface DashboardChartPalette {
  accent: string
  success: string
  warning: string
  danger: string
  border: string
  surface: string
  muted: string
  primary: string
}

const DASHBOARD_CHART_PALETTES: Record<DashboardResolvedTheme, DashboardChartPalette> = {
  dark: {
    accent: '#00E5FF',
    success: '#32D74B',
    warning: '#FFB539',
    danger: '#FF6B6B',
    border: '#2C2C2E',
    surface: '#1E1E1E',
    muted: '#98989D',
    primary: '#FFFFFF',
  },
  light: {
    accent: '#007C91',
    success: '#15803D',
    warning: '#9A5800',
    danger: '#B9333F',
    border: '#D5E0E8',
    surface: '#FFFFFF',
    muted: '#5B6B7A',
    primary: '#17212B',
  },
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function useChartTheme() {
  const { resolvedTheme } = useDashboardTheme()
  const palette = computed(() => DASHBOARD_CHART_PALETTES[resolvedTheme.value])
  const animationDuration = prefersReducedMotion() ? 0 : 220

  const baseTooltip = computed(() => ({
    backgroundColor: palette.value.surface,
    titleColor: palette.value.primary,
    bodyColor: palette.value.muted,
    borderColor: palette.value.border,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    displayColors: true,
    boxPadding: 6,
  }))

  const donutOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '78%',
    rotation: -90,
    circumference: 180,
    animation: { duration: animationDuration },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  }))

  const stackedColumnOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: animationDuration },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: baseTooltip.value,
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: palette.value.muted, font: { size: 11 } },
        border: { color: palette.value.border },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: palette.value.border },
        ticks: { color: palette.value.muted, font: { size: 11 } },
        border: { display: false },
      },
    },
  }))

  const stackedAreaOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: animationDuration },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: baseTooltip.value,
    },
    elements: {
      line: { tension: 0, borderWidth: 1.5, cubicInterpolationMode: 'monotone' },
      point: { radius: 0, hoverRadius: 4, hitRadius: 12 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: palette.value.muted, font: { size: 11 } },
        border: { color: palette.value.border },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: palette.value.border },
        ticks: { color: palette.value.muted, font: { size: 11 } },
        border: { display: false },
      },
    },
  }))

  return { resolvedTheme, palette, donutOptions, stackedColumnOptions, stackedAreaOptions }
}

export type ChartCenterTextPluginOptions = {
  primary: string
  secondary?: string
  primaryColor?: string
  secondaryColor?: string
}

export function chartCenterTextPlugin(opts: () => ChartCenterTextPluginOptions): Plugin<'doughnut'> {
  return {
    id: 'centerText',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart
      if (!chartArea) return
      const { primary, secondary, primaryColor, secondaryColor } = opts()
      const centerX = (chartArea.left + chartArea.right) / 2
      const centerY = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.18

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = primaryColor ?? DASHBOARD_CHART_PALETTES.dark.primary
      ctx.font = '600 28px Inter, ui-sans-serif, system-ui'
      ctx.fillText(primary, centerX, centerY)

      if (secondary) {
        ctx.fillStyle = secondaryColor ?? DASHBOARD_CHART_PALETTES.dark.muted
        ctx.font = '500 11px Inter, ui-sans-serif, system-ui'
        ctx.fillText(secondary, centerX, centerY + 22)
      }
      ctx.restore()
    },
  }
}
