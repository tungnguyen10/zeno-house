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
