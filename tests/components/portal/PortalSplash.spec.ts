import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import PortalSplash from '~/components/portal/PortalSplash.vue'

const source = readFileSync(resolve('app/components/portal/PortalSplash.vue'), 'utf8')

describe('PortalSplash', () => {
  it('announces the branded portal launch state accessibly', () => {
    const wrapper = mount(PortalSplash, {
      global: { stubs: { IconLogoSplash: true } },
    })

    const status = wrapper.get('[role="status"]')
    expect(status.attributes('aria-label')).toBe('Đang mở không gian của bạn')
  })

  it('disables both launch animations when reduced motion is requested', () => {
    const reducedMotion = source.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1]

    expect(reducedMotion).toMatch(/\.portal-splash__mark\s*\{\s*animation:\s*none/s)
    expect(reducedMotion).toMatch(/\.portal-splash__beam\s*\{\s*animation:\s*none/s)
  })
})
