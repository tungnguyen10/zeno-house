import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Filler,
  CategoryScale,
  LinearScale,
  Tooltip,
)

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui'
Chart.defaults.color = '#98989D'
Chart.defaults.borderColor = '#2C2C2E'
