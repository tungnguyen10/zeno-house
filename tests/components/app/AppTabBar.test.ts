import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import AppTabBar from '../../../app/components/app/AppTabBar.vue'
import { useAppFormMode } from '../../../app/composables/useAppFormMode'

const stubs = {
  NuxtLink: defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' }),
  IconMoreVertical: true,
  AppMoreSheet: true,
}

function mountTabBar() {
  return mount(AppTabBar, { global: { stubs } })
}

describe('AppTabBar', () => {
  beforeEach(() => {
    vi.stubGlobal('useRoute', () => ref({ path: '/dashboard' }).value)
    vi.stubGlobal('useAuthStore', () => ({ isAdmin: true, role: 'admin' }))
    useAppFormMode().value = false
  })

  it('renders the mobile navigation by default', () => {
    expect(mountTabBar().get('nav').classes()).not.toContain('max-sm:hidden')
  })

  it('yields the phone bottom edge while a form action bar is mounted', async () => {
    const wrapper = mountTabBar()
    useAppFormMode().value = true
    await nextTick()

    // Only phones swap: from `sm` up the form shows an inline action row instead.
    expect(wrapper.get('nav').classes()).toContain('max-sm:hidden')
  })
})
