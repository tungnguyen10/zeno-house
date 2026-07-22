import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('production deployment performance config', () => {
  it('deploys Vercel Functions beside the Singapore Supabase project', () => {
    const path = resolve(root, 'vercel.json')

    expect(existsSync(path)).toBe(true)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
      regions: ['sin1'],
    })
  })

  it('keeps Nuxt devtools disabled in production', () => {
    const config = readFileSync(resolve(root, 'nuxt.config.ts'), 'utf8')

    expect(config).toMatch(/devtools:\s*\{\s*enabled:\s*process\.env\.NODE_ENV\s*!==\s*["']production["']/)
  })

  it('registers Chart.js only inside chart-bearing component chunks', () => {
    expect(existsSync(resolve(root, 'app/plugins/chart.client.ts'))).toBe(false)
    const components = [
      'app/components/dashboard/DashboardBillingTrendChart.vue',
      'app/components/dashboard/DashboardCollectionDonut.vue',
      'app/components/portal/PortalPaymentRing.vue',
      'app/components/portal/PortalSpendingChart.vue',
    ]
    for (const component of components) {
      expect(readFileSync(resolve(root, component), 'utf8')).toContain("~/utils/chart-registration")
    }
  })

  it('ships only the subsetted Inter WOFF2 assets', () => {
    const stylesheet = readFileSync(resolve(root, 'app/assets/scss/main.scss'), 'utf8')
    const fontNames = [
      'Inter-VariableFont_opsz,wght',
      'Inter-Italic-VariableFont_opsz,wght',
    ]

    for (const name of fontNames) {
      expect(existsSync(resolve(root, `public/fonts/${name}.woff2`))).toBe(true)
      expect(existsSync(resolve(root, `public/fonts/${name}.ttf`))).toBe(false)
      expect(stylesheet).toContain(`/fonts/${name}.woff2`)
    }
    expect(stylesheet).not.toContain("format('truetype')")
    expect(stylesheet).toContain('U+1E00-1EFF')
  })
})
