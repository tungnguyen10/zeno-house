import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const appDir = fileURLToPath(new URL('./app', import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      '~': appDir,
      '@': appDir,
      '#supabase/server': fileURLToPath(new URL('./tests/__mocks__/supabase-server.ts', import.meta.url)),
      '#imports': fileURLToPath(new URL('./tests/__mocks__/nuxt-imports.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    root,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/services/billing/**'],
      thresholds: {
        branches: 25,
        functions: 28,
        lines: 36,
        statements: 32,
      },
    },
  },
})
