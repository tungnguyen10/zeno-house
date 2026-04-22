import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      colors: {
        room: {
          available: '#22c55e',
          occupied: '#ef4444',
          maintenance: '#f97316',
          reserved: '#3b82f6',
        },
      },
    },
  },
} satisfies Config
