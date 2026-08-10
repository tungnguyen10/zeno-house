import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appleStartupImages } from '../../pwa/apple-startup'

const root = process.cwd()
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8')
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type StartupImage = {
  href: string
  media: string
}

const mediaNumber = (media: string, name: string) => {
  const value = media.match(new RegExp(`${name}:\\s*(\\d+)px`))?.[1]
  expect(value, `missing ${name} in ${media}`).toBeDefined()
  return Number(value)
}

const mediaScale = (media: string) => {
  const value = media.match(/-webkit-device-pixel-ratio:\s*(\d+)/)?.[1]
  expect(value, `missing -webkit-device-pixel-ratio in ${media}`).toBeDefined()
  return Number(value)
}

const isPortrait = (media: string) => media.includes('orientation: portrait')
const isDark = (media: string) => media.includes('prefers-color-scheme: dark')

const pngDimensions = (path: string) => {
  const contents = readFileSync(path)
  expect(contents.subarray(0, 8)).toEqual(pngSignature)
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
  }
}

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
    for (const icon of ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']) {
      const path = resolve(root, 'public/icons', icon)
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path).subarray(0, 8)).toEqual(pngSignature)
    }
  })

  it('uses the portal light canvas as the manifest fallback without changing manifest icons', () => {
    expect(config).toMatch(/background_color:\s*"#f8fafc"/)
    expect(config).toMatch(/theme_color:\s*"#0b59db"/)
    expect(config).toContain('{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }')
    expect(config).toContain('{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }')
    expect(config).toContain('src: "/icons/maskable-512.png"')
    expect(config).toContain('purpose: "maskable"')
  })
})

describe('Apple startup images', () => {
  const config = read('nuxt.config.ts')
  const images: StartupImage[] = appleStartupImages

  it('registers media-qualified light and dark startup images for iPhone and iPad in both orientations', () => {
    expect(images).not.toHaveLength(0)
    expect(config).toContain('...appleStartupImages')

    const deviceClasses = {
      iPhone: (media: string) => mediaNumber(media, 'device-width') <= 430,
      iPad: (media: string) => mediaNumber(media, 'device-width') >= 744,
    }

    for (const [device, matches] of Object.entries(deviceClasses)) {
      for (const [appearance, appearanceMatches] of [
        ['light', (media: string) => !isDark(media)],
        ['dark', isDark],
      ] as const) {
        for (const [orientation, orientationMatches] of [
          ['portrait', isPortrait],
          ['landscape', (media: string) => !isPortrait(media)],
        ] as const) {
          expect(
            images.some(({ media }) => matches(media) && appearanceMatches(media) && orientationMatches(media)),
            `missing ${device} ${appearance} ${orientation} startup image`,
          ).toBe(true)
        }
      }
    }
  })

  it('points every startup link to a valid PNG whose dimensions match its media query', () => {
    const generatedAssets = readdirSync(resolve(root, 'public/images'))
      .filter(name => name.startsWith('apple-startup-') && name.endsWith('.png'))
      .sort()
    const linkedAssets = images.map(({ href }) => href.split('/').at(-1) ?? '').sort()

    expect(new Set(images.map(({ media }) => media)).size).toBe(images.length)
    expect(new Set(images.map(({ href }) => href)).size).toBe(images.length)
    expect(linkedAssets).toEqual(generatedAssets)

    for (const { href, media } of images) {
      expect(href).toMatch(/^\//)
      const path = resolve(root, 'public', href.slice(1))
      expect(existsSync(path), `missing startup image ${href}`).toBe(true)

      const { width, height } = pngDimensions(path)
      const density = mediaScale(media)
      const deviceWidth = mediaNumber(media, 'device-width') * density
      const deviceHeight = mediaNumber(media, 'device-height') * density
      const [expectedWidth, expectedHeight] = isPortrait(media)
        ? [deviceWidth, deviceHeight]
        : [deviceHeight, deviceWidth]
      expect({ width, height }).toEqual({ width: expectedWidth, height: expectedHeight })
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

  it('keeps the existing inject-manifest cache policy unchanged', () => {
    expect(config).toMatch(/strategies:\s*"injectManifest"/)
    expect(config).toMatch(/globPatterns:\s*\["offline\.html", "icons\/\*\.png", "favicon\.ico"\]/)
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
