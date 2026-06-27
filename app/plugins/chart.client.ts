import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LinearScale,
  Tooltip,
} from 'chart.js'

Chart.register(
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
)

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui'
Chart.defaults.color = '#98989D'
Chart.defaults.borderColor = '#2C2C2E'

export default defineNuxtPlugin(() => {
  // Registration happens at module top — keeping plugin empty avoids double-register.
})
