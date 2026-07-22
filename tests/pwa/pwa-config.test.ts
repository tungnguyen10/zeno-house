import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8')

describe('PWA manifest + registration config', () => {
  const config = read('nuxt.config.ts')

  it('registers a single installable PWA with autoUpdate', () => {
    expect(config).toContain('"@vite-pwa/nuxt"')
    expect(config).toMatch(/registerType:\s*"autoUpdate"/)
  })

  it('declares a valid manifest with vi lang, standalone, and 192/512 + maskable icons', () => {
    expect(config).toMatch(/name:\s*"Zeno House"/)
    expect(config).toMatch(/short_name:\s*"Zeno"/)
    expect(config).toMatch(/lang:\s*"vi"/)
    expect(config).toMatch(/display:\s*"standalone"/)
    expect(config).toMatch(/theme_color:/)
    expect(config).toMatch(/background_color:/)
    expect(config).toContain('/icons/icon-192.png')
    expect(config).toContain('/icons/icon-512.png')
    expect(config).toContain('purpose: "maskable"')
  })

  it('enables safe-area viewport and iOS install metadata', () => {
    expect(config).toContain('viewport-fit=cover')
    expect(config).toContain('apple-mobile-web-app-capable')
    expect(config).toContain('apple-touch-icon')
  })

  it('ships the icon set and apple-touch-icon as real PNGs', () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    for (const icon of ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']) {
      const path = resolve(root, 'public/icons', icon)
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path).subarray(0, 4)).toEqual(pngSignature)
    }
  })
})

describe('service worker — no authenticated personal data is cached', () => {
  const sw = read('app/service-worker/sw.ts')
  const config = read('nuxt.config.ts')

  it('precaches static assets only (no HTML pages, no api globs)', () => {
    const glob = config.match(/globPatterns:\s*\[(.*?)\]/s)?.[1] ?? ''
    expect(glob).toContain('offline.html')
    expect(glob).toContain('icons/')
    expect(glob).not.toContain('**/*.js')
    expect(glob).not.toContain('**/*.css')
    expect(glob).not.toContain('/api')
    expect(glob).not.toContain('supabase')
  })

  it('serves navigations with NetworkOnly and never caches them', () => {
    expect(sw).toContain('NetworkOnly')
    expect(sw).not.toContain('NetworkFirst')
    expect(sw).not.toContain('StaleWhileRevalidate')
    // No blanket runtime caching of supabase or tenant APIs.
    expect(sw).not.toContain('supabase.co')
    expect(sw).not.toMatch(/registerRoute\(\s*\/\^\\\/api/)
  })

  it('denylists /api navigations and falls back to a non-sensitive offline shell', () => {
    expect(sw).toContain('/offline.html')
    expect(sw).toMatch(/denylist:\s*\[[^\]]*\/\^\\\/api/)
  })
})

describe('offline shell — non-sensitive', () => {
  const offline = read('public/offline.html')

  it('exists and contains only branding + retry, no personal data', () => {
    expect(offline.toLowerCase()).toContain('ngoại tuyến')
    expect(offline).not.toContain('/api/tenant')
    expect(offline).not.toContain('supabase')
    expect(offline.toLowerCase()).not.toContain('signedurl')
  })
})
