import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config'

describe('dashboard semantic theme configuration', () => {
  it('maps semantic Tailwind colors to alpha-aware RGB variables', () => {
    const colors = tailwindConfig.theme.extend.colors as Record<string, unknown>

    expect(colors.ui).toMatchObject({
      canvas: 'rgb(var(--ui-canvas) / <alpha-value>)',
      surface: 'rgb(var(--ui-surface) / <alpha-value>)',
      primary: 'rgb(var(--ui-primary) / <alpha-value>)',
      muted: 'rgb(var(--ui-muted) / <alpha-value>)',
      accent: 'rgb(var(--ui-accent) / <alpha-value>)',
    })
    expect(colors.status).toMatchObject({
      success: 'rgb(var(--status-success) / <alpha-value>)',
      warning: 'rgb(var(--status-warning) / <alpha-value>)',
      danger: 'rgb(var(--status-danger) / <alpha-value>)',
    })
  })

  it('defines the approved light palette and the existing dark fallback', () => {
    const scss = readFileSync(resolve(process.cwd(), 'app/assets/scss/main.scss'), 'utf8')

    expect(scss).toContain(':root {')
    expect(scss).toContain('--ui-canvas: 26 27 29;')
    expect(scss).toContain("html[data-dashboard-theme='light']")
    expect(scss).toContain('--ui-canvas: 244 247 250;')
    expect(scss).toContain('--ui-surface: 255 255 255;')
    expect(scss).toContain('--ui-primary: 23 33 43;')
    expect(scss).toContain('--ui-muted: 91 107 122;')
    expect(scss).toContain('--ui-accent: 0 124 145;')
    expect(scss).toContain('--status-success: 21 128 61;')
    expect(scss).toContain('--status-warning: 154 88 0;')
    expect(scss).toContain('--status-danger: 185 51 63;')
  })

  it('uses semantic variables directly for the global body baseline', () => {
    const scss = readFileSync(resolve(process.cwd(), 'app/assets/scss/main.scss'), 'utf8')

    expect(scss).not.toContain('@apply bg-ui-canvas')
    expect(scss).toContain('background-color: rgb(var(--ui-canvas));')
    expect(scss).toContain('color: rgb(var(--ui-primary));')
  })
})
