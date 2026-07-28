import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../../tailwind.config'

const scss = readFileSync(resolve('app/assets/scss/main.scss'), 'utf8')

function contrastRatio(foreground: string, background: string): number {
  function luminance(hex: string): number {
    const channels = hex
      .replace('#', '')
      .match(/.{2}/g)!
      .map(channel => Number.parseInt(channel, 16) / 255)
      .map(channel => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  }

  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

function tintOnSurface(hex: string, surface: string, opacity = 0.1): string {
  const base = surface.replace('#', '').match(/.{2}/g)!.map(channel => Number.parseInt(channel, 16))
  const channels = hex.replace('#', '').match(/.{2}/g)!
    .map(channel => Number.parseInt(channel, 16))
    .map((channel, index) => Math.round(channel * opacity + base[index]! * (1 - opacity)))
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

describe('tenant portal design foundation', () => {
  it.each([
    ['--portal-primary', '#0d9488'],
    ['--portal-navy', '#1e3a5f'],
    ['--portal-bg', '#0b1624'],
    ['--portal-surface', '#14283d'],
    ['--portal-chrome', '#102a46'],
    ['--portal-accent', '#2dd4bf'],
    ['--portal-warning', '#fb923c'],
  ])('defines the dark-first MapTrack %s token as %s', (token, value) => {
    expect(scss).toContain(`${token}: ${value}`)
  })

  it('defines a light MapTrack override without changing the portal scope', () => {
    expect(scss).toMatch(/\.portal-shell\[data-theme='light'\]\s*\{/)
    expect(scss).toContain('--portal-bg: #f8fafc')
    expect(scss).toContain('--portal-surface: #ffffff')
    expect(scss).toContain('--portal-chrome: #1e3a5f')
    expect(scss).toContain('--portal-accent: #0d9488')
    expect(scss).toContain('--portal-warning: #f97316')
  })

  it('defines two named portal elevation roles for both appearances', () => {
    expect([...new Set(scss.match(/--portal-elevation-[\w-]+(?=:\s)/g))]).toEqual([
      '--portal-elevation-resting',
      '--portal-elevation-raised',
    ])
  })

  it('derives translucent accent borders from the active MapTrack accent token', () => {
    expect(scss).toMatch(/\.portal-shell \.border-theme\\\/30\s*\{\s*border-color:\s*color-mix\(in srgb, var\(--portal-accent\) 30%, transparent\)/s)
    expect(scss).toMatch(/\.portal-shell \.border-theme\\\/40[\s\S]*?color-mix\(in srgb, var\(--portal-accent\) 40%, transparent\)/s)
  })

  it.each(['display', 'heading', 'label', 'body', 'caption'])(
    'defines the %s type role',
    role => expect(scss).toContain(`.portal-type-${role}`),
  )

  it('defines tabular money and distinct currency-unit treatments', () => {
    expect(scss).toMatch(/\.portal-money\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s)
    expect(scss).toMatch(/\.portal-money-unit\s*\{[^}]*color:\s*var\(--portal-body\)/s)
  })

  it('keeps dashboard Tailwind status aliases unchanged', () => {
    const colors = tailwindConfig.theme.extend.colors
    expect(colors.warning).toBe('#FFB539')
    expect(colors.cyan).toBe('#00E5FF')
  })

  it('keeps portal body text at WCAG AA contrast in both modes', () => {
    expect(contrastRatio('#CBD5E1', '#14283D')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#475569', '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['dark positive ink', '#6EE7B7', '#14283D'],
    ['dark warning ink', '#FDBA74', '#14283D'],
    ['dark danger ink', '#FCA5A5', '#14283D'],
  ])('keeps %s at WCAG AA contrast on its tinted badge surface', (_name, ink, surface) => {
    expect(contrastRatio(ink, tintOnSurface(ink, surface))).toBeGreaterThanOrEqual(4.5)
  })
})
