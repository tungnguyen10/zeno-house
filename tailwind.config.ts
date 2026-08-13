import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic operational theme ──────────
        // RGB channel variables keep Tailwind opacity modifiers (`/10`, `/95`)
        // available while the dashboard swaps resolved light/dark values.
        ui: {
          canvas: 'rgb(var(--ui-canvas) / <alpha-value>)',
          chrome: 'rgb(var(--ui-chrome) / <alpha-value>)',
          surface: 'rgb(var(--ui-surface) / <alpha-value>)',
          hover: 'rgb(var(--ui-hover) / <alpha-value>)',
          deep: 'rgb(var(--ui-deep) / <alpha-value>)',
          border: 'rgb(var(--ui-border) / <alpha-value>)',
          'border-strong': 'rgb(var(--ui-border-strong) / <alpha-value>)',
          primary: 'rgb(var(--ui-primary) / <alpha-value>)',
          muted: 'rgb(var(--ui-muted) / <alpha-value>)',
          accent: 'rgb(var(--ui-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--ui-accent-hover) / <alpha-value>)',
          'on-accent': 'rgb(var(--ui-on-accent) / <alpha-value>)',
          overlay: 'rgb(var(--ui-overlay) / <alpha-value>)',
          shadow: 'rgb(var(--ui-shadow) / <alpha-value>)',
          skeleton: 'rgb(var(--ui-skeleton) / <alpha-value>)',
          knob: 'rgb(var(--ui-knob) / <alpha-value>)',
        },
        status: {
          neutral: 'rgb(var(--status-neutral) / <alpha-value>)',
          success: 'rgb(var(--status-success) / <alpha-value>)',
          warning: 'rgb(var(--status-warning) / <alpha-value>)',
          danger: 'rgb(var(--status-danger) / <alpha-value>)',
          'on-danger': 'rgb(var(--status-on-danger) / <alpha-value>)',
          'danger-surface': 'rgb(var(--status-danger-surface) / <alpha-value>)',
        },

        // ── Brand ──────────────────────────────
        theme: {
          DEFAULT: '#1554F0',
          purple: '#6653E8',
        },
        brand: '#79F4E4',

        // ── Text ───────────────────────────────
        title: '#0B1422',
        body: '#5B6472',
        muted: '#98989D',       // label / secondary text trên dark bg

        // ── Backgrounds ────────────────────────
        smoke: {
          DEFAULT: '#F4F6FB',
          blue: '#EAF0FF',
          card: '#F4F6F8',
        },

        // ── Borders ────────────────────────────
        border: {
          DEFAULT: '#D5D7DA',
          light: '#E6E9EF',
        },

        // ── Tenant portal semantics ────────────
        // Portal shares the internal dark theme; these status aliases use
        // vivid, dark-surface-friendly values and are opted into explicitly.
        portal: {
          muted: '#98989D',
          positive: '#32D74B',
          'positive-ink': '#32D74B',
          warning: '#FFB539',
          'warning-ink': '#FFB539',
          danger: '#FF453A',
          'danger-ink': '#FF6B6B',
        },

        // ── Status ─────────────────────────────
        success: {
          DEFAULT: '#28A745',   // trạng thái thành công
          neon: '#32D74B',      // "Đang hoạt động / Live" — neon green
        },
        error: {
          DEFAULT: '#DC3545',   // lỗi chuẩn
          vivid: '#FF453A',     // cảnh báo nổi bật trên dark bg
          bg: '#3A1C1C',        // nền hộp alert đỏ
        },
        warning: '#FFB539',

        // ── Data / Charts ───────────────────────
        cyan: '#00E5FF',        // KPI accent, đường chart chính

        // ── Dark sections / Dashboard ───────────
        dark: {
          DEFAULT: '#1A1B1D',
          card: '#242528',
          surface: '#1E1E1E',   // card surface dark mode
          border: '#2C2C2E',    // viền card / grid line chart
          hover: '#252525',     // hover row trong dark table
          nav: '#001C49',
          deep: '#0a0f1e',
        },
      },
      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
      },
    },
  },
  plugins: [],
} satisfies Config
