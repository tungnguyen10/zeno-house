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
    ['--portal-title', '#ffffff'],
    ['--portal-body', '#c7c9ce'],
    ['--portal-muted', '#98989d'],
    ['--portal-accent', '#00e5ff'],
    ['--portal-accent-soft', 'rgb(0 229 255 / 0.12)'],
    ['--portal-bg', '#1a1b1d'],
    ['--portal-surface', '#242528'],
    ['--portal-border', '#2c2c2e'],
    ['--portal-positive', '#32d74b'],
    ['--portal-positive-ink', '#32d74b'],
    ['--portal-warning', '#ffb539'],
    ['--portal-warning-ink', '#ffb539'],
    ['--portal-danger', '#ff453a'],
    ['--portal-danger-ink', '#ff6b6b'],
  ])('defines %s as %s', (token, value) => {
    expect(scss).toContain(`${token}: ${value}`)
  })

  it('defines exactly two portal elevation roles', () => {
    expect(scss).toMatch(/--portal-elevation-resting:/)
    expect(scss).toMatch(/--portal-elevation-raised:/)
    expect(scss.match(/--portal-elevation-/g)).toHaveLength(2)
  })

  it.each(['display', 'heading', 'label', 'body', 'caption'])(
    'defines the %s type role',
    role => expect(scss).toContain(`.portal-type-${role}`),
  )

  it('defines tabular money and distinct currency-unit treatments', () => {
    expect(scss).toMatch(/\.portal-money\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s)
    expect(scss).toMatch(/\.portal-money-unit\s*\{[^}]*color:\s*var\(--portal-body\)/s)
  })

  it('exposes portal Tailwind color aliases without replacing admin status colors', () => {
    const colors = tailwindConfig.theme.extend.colors
    expect(colors.portal).toMatchObject({
      muted: '#98989D',
      positive: '#32D74B',
      'positive-ink': '#32D74B',
      warning: '#FFB539',
      'warning-ink': '#FFB539',
      danger: '#FF453A',
      'danger-ink': '#FF6B6B',
    })
    expect(colors.warning).toBe('#FFB539')
  })

  it('keeps portal body text at WCAG AA contrast on surface and canvas', () => {
    expect(contrastRatio('#C7C9CE', '#242528')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#C7C9CE', '#1A1B1D')).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['positive ink', '#32D74B'],
    ['warning ink', '#FFB539'],
    ['danger ink', '#FF6B6B'],
  ])('keeps %s at WCAG AA contrast on its tinted badge surface', (_name, ink) => {
    expect(contrastRatio(ink, tintOnSurface(ink, '#242528'))).toBeGreaterThanOrEqual(4.5)
  })
})
