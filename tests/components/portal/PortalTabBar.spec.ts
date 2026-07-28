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
        IconPortalTabHomeDark: true,
        IconPortalTabInvoicesDark: true,
        IconPortalTabRoomDark: true,
        IconPortalTabRequestsDark: true,
        IconPortalTabAccountDark: true,
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

  it('uses the five SVG components exported from the Figma dark variant', () => {
    const wrapper = mountTabBar()

    expect(wrapper.findAll('icon-portal-tab-home-dark-stub')).toHaveLength(1)
    expect(wrapper.findAll('icon-portal-tab-invoices-dark-stub')).toHaveLength(1)
    expect(wrapper.findAll('icon-portal-tab-room-dark-stub')).toHaveLength(1)
    expect(wrapper.findAll('icon-portal-tab-requests-dark-stub')).toHaveLength(1)
    expect(wrapper.findAll('icon-portal-tab-account-dark-stub')).toHaveLength(1)
  })

  it('uses ≥44px touch targets on every tab', () => {
    const wrapper = mountTabBar()
    for (const link of wrapper.findAll('a')) {
      expect(link.classes()).toContain('min-h-[56px]')
      expect(link.classes()).toContain('max-w-[70px]')
    }
  })

  it('marks the active tab based on the current route', () => {
    const wrapper = mountTabBar()
    const links = wrapper.findAll('a')
    // /portal/invoices → the "Hoá đơn" tab (index 1) is active.
    const active = links[1]!
    expect(active.classes()).toContain('text-[color:var(--portal-body)]')
    expect(active.classes()).toContain('bg-[color:var(--portal-surface-muted)]')
    expect(active.attributes('aria-current')).toBe('page')
    expect(wrapper.get('icon-portal-tab-invoices-dark-stub').classes()).toContain('text-[color:var(--portal-accent)]')
    // Home tab is exact-match only, so it must NOT be active here.
    const home = links[0]!
    expect(home.classes()).toContain('text-[color:var(--portal-body)]')
    expect(home.classes()).toContain('[@media(hover:hover)]:hover:bg-[color:var(--portal-surface-muted)]')
    expect(home.classes()).toContain('active:bg-[color:var(--portal-surface-deep)]')
    expect(home.classes()).not.toContain('active:scale-[0.98]')
    expect(home.attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('icon-portal-tab-home-dark-stub').classes()).toContain('text-[color:var(--portal-muted)]')
  })

  it('uses the Figma mobile rail surface, active emphasis, and keyboard focus affordances', () => {
    const wrapper = mountTabBar()
    expect(wrapper.get('nav').classes()).toEqual(expect.arrayContaining([
      'portal-safe-bottom',
      'portal-safe-x',
      'rounded-t-[20px]',
      'bg-[color:var(--portal-chrome)]',
      'border-[color:var(--portal-border)]',
    ]))
    for (const link of wrapper.findAll('a')) {
      expect(link.classes()).toContain('focus-visible:ring-2')
    }
  })
})
