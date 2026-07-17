import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PortalTabBar from '~/components/portal/PortalTabBar.vue'

vi.stubGlobal('useRoute', () => ({ path: '/portal/invoices' }))

const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to" :class="$attrs.class" :aria-current="$attrs[\'aria-current\']"><slot /></a>',
}

function mountTabBar() {
  return mount(PortalTabBar, {
    global: {
      stubs: {
        NuxtLink: NuxtLinkStub,
        IconHome: true,
        IconReceipt: true,
        IconDoor: true,
        IconMessageCircle: true,
        IconUser: true,
      },
    },
  })
}

describe('PortalTabBar', () => {
  it('renders the five primary tabs with their labels', () => {
    const wrapper = mountTabBar()
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(5)
    expect(wrapper.text()).toContain('Trang chủ')
    expect(wrapper.text()).toContain('Hoá đơn')
    expect(wrapper.text()).toContain('Phòng')
    expect(wrapper.text()).toContain('Yêu cầu')
    expect(wrapper.text()).toContain('Tài khoản')
  })

  it('uses ≥44px touch targets on every tab', () => {
    const wrapper = mountTabBar()
    for (const link of wrapper.findAll('a')) {
      expect(link.classes()).toContain('min-h-[56px]')
    }
  })

  it('marks the active tab based on the current route', () => {
    const wrapper = mountTabBar()
    const links = wrapper.findAll('a')
    // /portal/invoices → the "Hoá đơn" tab (index 1) is active.
    const active = links[1]!
    expect(active.classes()).toContain('text-theme')
    expect(active.attributes('aria-current')).toBe('page')
    // Home tab is exact-match only, so it must NOT be active here.
    const home = links[0]!
    expect(home.classes()).toContain('text-body')
    expect(home.attributes('aria-current')).toBeUndefined()
  })
})
