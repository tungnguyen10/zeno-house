import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AppSidebar from '../../../app/components/app/AppSidebar.vue'

const iconStub = defineComponent({ template: '<span />' })

const stubs = {
  IconChart: iconStub,
  IconBuilding: iconStub,
  IconDoor: iconStub,
  IconUsers: iconStub,
  IconDocumentText: iconStub,
  IconDocument: iconStub,
  IconBriefcase: iconStub,
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

function mountSidebar(role: 'admin' | 'owner' | 'manager', path = '/') {
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useAuthStore', () => ({
    isAdmin: role === 'admin',
    role,
    user: { email: `${role}@zeno.test` },
  }))

  return mount(AppSidebar, { global: { stubs } })
}

describe('AppSidebar role visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useAppStore', () => ({ sidebarCollapsed: false, toggleCollapsed: vi.fn() }))
    vi.stubGlobal('storeToRefs', () => ({ sidebarCollapsed: ref(false) }))
  })

  it('shows Settings user management to admin', () => {
    expect(mountSidebar('admin').text()).toContain('Settings')
  })

  it('shows Settings user management to owner', () => {
    expect(mountSidebar('owner').text()).toContain('Settings')
  })

  it('hides Settings user management from manager', () => {
    expect(mountSidebar('manager').text()).not.toContain('Settings')
  })

  it('marks only Buildings active on the buildings route', () => {
    const wrapper = mountSidebar('admin', '/dashboard/buildings')
    const dashboard = wrapper.get('a[href="/dashboard"]')
    const buildings = wrapper.get('a[href="/dashboard/buildings"]')

    expect(dashboard.classes()).not.toContain('bg-cyan/10')
    expect(buildings.classes()).toContain('bg-cyan/10')
  })

  it('links both sidebar logos directly to the dashboard namespace', () => {
    const logoLinks = mountSidebar('admin').findAll('a[aria-label="Zeno House — Trang chủ"]')

    expect(logoLinks).toHaveLength(2)
    expect(logoLinks.every(link => link.attributes('href') === '/dashboard')).toBe(true)
  })
})
