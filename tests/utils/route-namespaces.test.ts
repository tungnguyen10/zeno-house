import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '../../app/utils/constants/navigation'
import { getLegacyDashboardRedirect } from '../../app/utils/routes/namespace'

const appPages = resolve(process.cwd(), 'app/pages')

describe('route namespace structure', () => {
  it('targets the dashboard namespace from every internal navigation item', () => {
    expect(NAV_ITEMS.every(item => item.to.startsWith('/dashboard'))).toBe(true)
  })

  it.each([
    ['/buildings', '/dashboard/buildings'],
    ['/rooms/a-101/edit', '/dashboard/rooms/a-101/edit'],
    ['/billing/toa-a/2026-06?invoice=inv-1', '/dashboard/billing/toa-a/2026-06?invoice=inv-1'],
    ['/settings/managers', '/dashboard/settings/managers'],
    ['/settings/history', '/dashboard/settings/history'],
  ])('maps legacy route %s to %s', (legacyPath, expected) => {
    expect(getLegacyDashboardRedirect(legacyPath)).toBe(expected)
  })

  it.each(['/dashboard', '/dashboard/buildings', '/portal', '/login', '/auth/callback'])('does not rewrite %s', (path) => {
    expect(getLegacyDashboardRedirect(path)).toBeNull()
  })

  it('contains dashboard and portal entry pages', () => {
    expect(existsSync(`${appPages}/dashboard/index.vue`)).toBe(true)
    expect(existsSync(`${appPages}/portal/index.vue`)).toBe(true)
    expect(existsSync(`${appPages}/index.vue`)).toBe(true)
  })

  it('rejects authenticated pages outside the declared namespaces', () => {
    const publicOrLandingPages = new Set([
      'auth/callback.vue',
      'auth/pending.vue',
      'auth/reset-password.vue',
      'forgot-password.vue',
      'index.vue',
      'login.vue',
      'register.vue',
    ])
    const pageFiles = readdirSync(appPages, { recursive: true })
      .map(path => path.replaceAll('\\', '/'))
      .filter(path => path.endsWith('.vue'))

    const unnamespacedPages = pageFiles.filter(path => (
      !path.startsWith('dashboard/')
      && !path.startsWith('portal/')
      && !publicOrLandingPages.has(path)
    ))

    expect(unnamespacedPages).toEqual([])
  })
})
