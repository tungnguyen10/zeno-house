import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AppSidebar from '../../../app/components/app/AppSidebar.vue'

const iconStub = defineComponent({ template: '<span />' })

const stubs = {
  IconHome: iconStub,
  IconChart: iconStub,
  IconBuilding: iconStub,
  IconDoor: iconStub,
  IconUsers: iconStub,
  IconDocumentText: iconStub,
  IconReceipt: iconStub,
  IconCalendar: iconStub,
  IconLayers: iconStub,
  IconUser: iconStub,
  IconLock: iconStub,
  IconSettings: iconStub,
  IconClock: iconStub,
  IconLogo: iconStub,
  IconLogoMini: iconStub,
  IconPanelLeft: iconStub,
  IconX: iconStub,
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots }) {
      return () => h('a', { href: props.to }, slots.default?.())
    },
  }),
  UiButton: defineComponent({
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { onClick: () => emit('click') }, slots.default?.())
    },
  }),
}

function mountSidebar(role: 'admin' | 'owner' | 'manager', path = '/', collapsed = false) {
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useAuthStore', () => ({
    isAdmin: role === 'admin',
    role,
    user: { email: `${role}@zeno.test` },
  }))
  vi.stubGlobal('storeToRefs', () => ({ sidebarCollapsed: ref(collapsed) }))

  return mount(AppSidebar, { global: { stubs } })
}

describe('AppSidebar role visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useAppStore', () => ({ sidebarCollapsed: false, toggleCollapsed: vi.fn() }))
  })

  it('groups admin destinations in the canonical section order', () => {
    const wrapper = mountSidebar('admin')
    const sectionKeys = wrapper.findAll('[data-nav-section]').map(section => section.attributes('data-nav-section'))
    const hrefsIn = (section: string) => wrapper
      .get(`[data-nav-section="${section}"]`)
      .findAll('a')
      .map(link => link.attributes('href'))

    expect(sectionKeys).toEqual(['primary', 'rental', 'finance', 'administration'])
    expect(hrefsIn('primary')).toEqual(['/dashboard'])
    expect(hrefsIn('rental')).toEqual([
      '/dashboard/buildings',
      '/dashboard/rooms',
      '/dashboard/tenants',
      '/dashboard/contracts',
    ])
    expect(hrefsIn('finance')).toEqual([
      '/dashboard/billing',
      '/dashboard/invoices',
      '/dashboard/shared-expenses',
      '/dashboard/operations-report',
    ])
    expect(hrefsIn('administration')).toEqual([
      '/dashboard/settings/managers',
      '/dashboard/settings/tenant-accounts',
      '/dashboard/settings/access-requests',
      '/dashboard/settings/history',
    ])
    expect(wrapper.get('[data-nav-section="primary"]').find('[data-nav-section-label]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Tài sản & cho thuê')
    expect(wrapper.text()).toContain('Tài chính & vận hành')
    expect(wrapper.text()).toContain('Quản trị')
  })

  it('shows the role-filtered administration section to owner', () => {
    const wrapper = mountSidebar('owner')
    const administration = wrapper.get('[data-nav-section="administration"]')

    expect(administration.text()).toContain('Quản lý người dùng')
    expect(administration.text()).toContain('Tài khoản người thuê')
    expect(administration.text()).not.toContain('Yêu cầu truy cập')
    expect(administration.text()).not.toContain('Nhật ký hoạt động')
  })

  it('omits the empty administration section for manager', () => {
    expect(mountSidebar('manager').find('[data-nav-section="administration"]').exists()).toBe(false)
  })

  it('marks only Buildings current on a nested buildings route', () => {
    const wrapper = mountSidebar('admin', '/dashboard/buildings/building-1/settings')
    const dashboard = wrapper.get('a[href="/dashboard"]')
    const buildings = wrapper.get('a[href="/dashboard/buildings"]')
    const currentLinks = wrapper.findAll('a[aria-current="page"]')

    expect(dashboard.classes()).not.toContain('bg-cyan/10')
    expect(buildings.classes()).toContain('bg-cyan/10')
    expect(currentLinks).toHaveLength(1)
    expect(currentLinks[0]?.attributes('href')).toBe('/dashboard/buildings')
  })

  it('keeps collapsed link labels available to assistive technology', () => {
    const dashboardLabel = mountSidebar('admin', '/dashboard', true)
      .get('a[href="/dashboard"] [data-nav-label]')

    expect(dashboardLabel.text()).toBe('Dashboard')
    expect(dashboardLabel.classes()).toContain('lg:sr-only')
  })

  it('emits close when a navigation link is selected', async () => {
    const wrapper = mountSidebar('admin')
    const invoiceLink = wrapper.get('a[href="/dashboard/invoices"]')

    expect(invoiceLink.classes()).toContain('min-h-11')
    expect(invoiceLink.classes()).toContain('whitespace-nowrap')
    expect(invoiceLink.classes()).toContain('focus-visible:ring-2')
    expect(invoiceLink.classes()).toContain('transition-colors')
    expect(invoiceLink.classes()).not.toContain('transition-all')

    await invoiceLink.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('links both sidebar logos directly to the dashboard namespace', () => {
    const logoLinks = mountSidebar('admin').findAll('a[aria-label="Zeno House — Trang chủ"]')

    expect(logoLinks).toHaveLength(2)
    expect(logoLinks.every(link => link.attributes('href') === '/dashboard')).toBe(true)
  })
})
