import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AppSettingsNav from '../../../app/components/app/AppSettingsNav.vue'

const stubs = {
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots, attrs }) {
      return () => h('a', { ...attrs, href: props.to }, slots.default?.())
    },
  }),
  IconChevronRight: true,
}

const pendingCount = ref<number | null>(null)
const pendingEnabled = vi.fn()

function mountNav(role: 'admin' | 'owner' | 'manager', path = '/dashboard/settings/profile', variant: 'sidebar' | 'list' = 'sidebar') {
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useAuthStore', () => ({ isAdmin: role === 'admin', role }))
  vi.stubGlobal('useAccessRequestPendingCount', (enabled: () => boolean) => {
    pendingEnabled(enabled())
    return pendingCount
  })
  return mount(AppSettingsNav, { props: { variant }, global: { stubs } })
}

beforeEach(() => {
  vi.clearAllMocks()
  pendingCount.value = null
})

describe('AppSettingsNav', () => {
  it('labels the landmark and renders groups for admin', () => {
    const wrapper = mountNav('admin')

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Cài đặt')
    expect(wrapper.findAll('[data-settings-group]').map(group => group.attributes('data-settings-group')))
      .toEqual(['personal', 'administration', 'buildings'])
    expect(wrapper.text()).toContain('Cá nhân')
    expect(wrapper.text()).toContain('Quản trị')
  })

  it('shows only personal and buildings to manager and never enables the pending request', () => {
    const wrapper = mountNav('manager')

    expect(wrapper.findAll('[data-settings-group]').map(group => group.attributes('data-settings-group')))
      .toEqual(['personal', 'buildings'])
    expect(pendingEnabled).toHaveBeenCalledWith(false)
  })

  it('marks the current item in the sidebar variant, including nested paths', () => {
    const wrapper = mountNav('admin', '/dashboard/settings/history')
    const current = wrapper.findAll('a[aria-current="page"]')

    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('href')).toBe('/dashboard/settings/history')
  })

  it('does not mark items current in the list variant', () => {
    const wrapper = mountNav('admin', '/dashboard/settings', 'list')

    expect(wrapper.find('a[aria-current="page"]').exists()).toBe(false)
  })

  it('shows the pending badge with an accessible label only on access requests', () => {
    pendingCount.value = 3
    const wrapper = mountNav('admin')
    const access = wrapper.get('a[href="/dashboard/settings/access-requests"]')

    expect(access.text()).toContain('3')
    expect(access.text()).toContain('3 yêu cầu đang chờ duyệt')
    expect(wrapper.get('a[href="/dashboard/settings/managers"]').text()).not.toMatch(/\d/)
  })

  it('hides the badge for zero or unknown counts and caps large counts', () => {
    pendingCount.value = 0
    expect(mountNav('admin').get('a[href="/dashboard/settings/access-requests"]').text()).not.toMatch(/\d/)

    pendingCount.value = null
    expect(mountNav('admin').get('a[href="/dashboard/settings/access-requests"]').text()).not.toMatch(/\d/)

    pendingCount.value = 140
    expect(mountNav('admin').get('a[href="/dashboard/settings/access-requests"]').text()).toContain('99+')
  })
})
