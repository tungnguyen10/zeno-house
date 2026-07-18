import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PortalHeader from '~/components/portal/PortalHeader.vue'

vi.stubGlobal('usePortalChrome', () => ({
  chrome: ref({ title: 'Chi tiết hoá đơn', back: '/portal/invoices' }),
}))
vi.stubGlobal('useRouter', () => ({ back: vi.fn() }))
vi.stubGlobal('navigateTo', vi.fn())

describe('PortalHeader', () => {
  it('keeps safe-area padding and gives the back control an accessible focus state', () => {
    const wrapper = mount(PortalHeader, {
      global: { stubs: { IconArrowLeft: true } },
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['portal-safe-top', 'portal-safe-x']))
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Quay lại')
    expect(button.classes()).toEqual(expect.arrayContaining([
      'focus-visible:ring-2',
      'focus-visible:ring-theme/40',
    ]))
  })

  it('uses the portal heading type role for the current page title', () => {
    const wrapper = mount(PortalHeader, {
      global: { stubs: { IconArrowLeft: true } },
    })
    expect(wrapper.get('h1').classes()).toContain('portal-type-heading')
  })
})
