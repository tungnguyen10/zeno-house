import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('portal interaction polish', () => {
  it('defines scoped motion tokens and removes route translation for reduced motion', () => {
    const styles = source('app/assets/scss/main.scss')

    expect(styles).toContain('--portal-motion-micro: 120ms')
    expect(styles).toContain('--portal-motion-short: 220ms')
    expect(styles).toContain('--portal-ease-out: cubic-bezier(0.16, 1, 0.3, 1)')
    expect(styles).toMatch(/prefers-reduced-motion:[\s\S]*?transform: none/)
  })

  it('does not use transition-all in portal UI', () => {
    const files = [
      'app/components/portal/PortalBottomSheet.vue',
      'app/components/portal/PortalInstallPrompt.vue',
      'app/components/portal/PortalToastHost.vue',
    ]

    for (const file of files) {
      expect(source(file), file).not.toContain('transition-all')
    }
  })

  it('keeps close controls visibly focusable', () => {
    for (const file of [
      'app/components/portal/PortalBottomSheet.vue',
      'app/components/portal/PortalInstallPrompt.vue',
      'app/components/portal/PortalToastHost.vue',
    ]) {
      expect(source(file), file).toContain('focus-visible:ring-2')
    }
  })

  it('does not make the live-region status itself clickable', () => {
    const toast = source('app/components/portal/PortalToastHost.vue')

    const statusOpeningTag = toast.match(/<div[\s\S]*?role="status"[\s\S]*?>/)?.[0]
    expect(statusOpeningTag).not.toContain('@click')
    expect(toast).toContain('aria-label="Đóng thông báo"')
  })
})
