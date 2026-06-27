import type { ChartOptions, Plugin } from 'chart.js'

export const dashboardChartPalette = {
  cyan: '#00E5FF',
  successNeon: '#32D74B',
  warning: '#FFB539',
  errorVivid: '#FF453A',
  darkBorder: '#2C2C2E',
  darkSurface: '#1E1E1E',
  muted: '#98989D',
  white: '#FFFFFF',
} as const

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function useChartTheme() {
  const animationDuration = prefersReducedMotion() ? 0 : 220

  const baseTooltip = {
    backgroundColor: dashboardChartPalette.darkSurface,
    titleColor: dashboardChartPalette.white,
    bodyColor: dashboardChartPalette.muted,
    borderColor: dashboardChartPalette.darkBorder,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    displayColors: true,
    boxPadding: 6,
  }

  const donutOptions: ChartOptions<'doughnut'> = {
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
  }

  const stackedColumnOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: animationDuration },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: baseTooltip,
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: dashboardChartPalette.muted, font: { size: 11 } },
        border: { color: dashboardChartPalette.darkBorder },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: dashboardChartPalette.darkBorder },
        ticks: { color: dashboardChartPalette.muted, font: { size: 11 } },
        border: { display: false },
      },
    },
  }

  return { palette: dashboardChartPalette, donutOptions, stackedColumnOptions }
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
      // Half-donut: center vertically on the arc baseline rather than mid-canvas
      const centerY = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.18

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = primaryColor ?? dashboardChartPalette.white
      ctx.font = '600 28px Inter, ui-sans-serif, system-ui'
      ctx.fillText(primary, centerX, centerY)

      if (secondary) {
        ctx.fillStyle = secondaryColor ?? dashboardChartPalette.muted
        ctx.font = '500 11px Inter, ui-sans-serif, system-ui'
        ctx.fillText(secondary, centerX, centerY + 22)
      }
      ctx.restore()
    },
  }
}
