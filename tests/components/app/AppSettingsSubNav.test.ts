import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AppSettingsSubNav from '../../../app/components/app/AppSettingsSubNav.vue'

const stubs = {
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots }) {
      return () => h('a', { href: props.to }, slots.default?.())
    },
  }),
}

function mountSubNav(role: 'admin' | 'owner' | 'manager', path = '/dashboard/settings/managers') {
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useAuthStore', () => ({ isAdmin: role === 'admin', role }))

  return mount(AppSettingsSubNav, { global: { stubs } })
}

describe('AppSettingsSubNav role visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows all four tabs to admin', () => {
    const wrapper = mountSubNav('admin')

    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
      '/dashboard/settings/managers',
      '/dashboard/settings/tenant-accounts',
      '/dashboard/settings/buildings',
      '/dashboard/settings/access-requests',
      '/dashboard/settings/history',
    ])
  })

  it('hides admin-only tabs from owner', () => {
    const wrapper = mountSubNav('owner')

    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
      '/dashboard/settings/managers',
      '/dashboard/settings/tenant-accounts',
    ])
  })

  it('marks the current tab active', () => {
    const wrapper = mountSubNav('admin', '/dashboard/settings/history')
    const active = wrapper.get('a[aria-current="page"]')

    expect(active.attributes('href')).toBe('/dashboard/settings/history')
  })
})
