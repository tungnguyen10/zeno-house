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

function mountSidebar(role: 'admin' | 'owner' | 'manager') {
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
    vi.stubGlobal('useRoute', () => ({ path: '/' }))
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
})
