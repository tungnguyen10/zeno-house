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

function tintOnWhite(hex: string, opacity = 0.1): string {
  const channels = hex.replace('#', '').match(/.{2}/g)!
    .map(channel => Number.parseInt(channel, 16))
    .map(channel => Math.round(channel * opacity + 255 * (1 - opacity)))
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

describe('tenant portal design foundation', () => {
  it.each([
    ['--portal-title', '#0b1422'],
    ['--portal-body', '#5b6472'],
    ['--portal-muted', '#8a93a3'],
    ['--portal-accent', '#1554f0'],
    ['--portal-accent-soft', '#eaf0ff'],
    ['--portal-bg', '#f4f6fb'],
    ['--portal-surface', '#ffffff'],
    ['--portal-border', '#e6e9ef'],
    ['--portal-positive', '#0e9f6e'],
    ['--portal-positive-ink', '#087a55'],
    ['--portal-warning', '#b7791f'],
    ['--portal-warning-ink', '#8a5615'],
    ['--portal-danger', '#e02424'],
    ['--portal-danger-ink', '#b91c1c'],
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
      muted: '#8A93A3',
      positive: '#0E9F6E',
      'positive-ink': '#087A55',
      warning: '#B7791F',
      'warning-ink': '#8A5615',
      danger: '#E02424',
      'danger-ink': '#B91C1C',
    })
    expect(colors.warning).toBe('#FFB539')
  })

  it('keeps portal body text at WCAG AA contrast on surface and canvas', () => {
    expect(contrastRatio('#5B6472', '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#5B6472', '#F4F6FB')).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['positive ink', '#087A55', '#0E9F6E'],
    ['warning ink', '#8A5615', '#B7791F'],
    ['danger ink', '#B91C1C', '#E02424'],
  ])('keeps %s at WCAG AA contrast on its tinted badge surface', (_name, ink, accent) => {
    expect(contrastRatio(ink, tintOnWhite(accent))).toBeGreaterThanOrEqual(4.5)
  })
})
