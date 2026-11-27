import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import UiPageHeader from '../../../app/components/ui/UiPageHeader.vue'

vi.stubGlobal('useAppHeaderBack', () => ref(null))

describe('UiPageHeader', () => {
  it('reserves desktop space for global shell actions', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Dashboard', description: 'Tổng quan vận hành' },
      global: {
        stubs: {
          NuxtLink: defineComponent({ template: '<a><slot /></a>' }),
          IconArrowLeft: true,
        },
      },
    })

    expect(wrapper.classes()).toContain('lg:pr-44')
    expect(wrapper.classes()).not.toContain('lg:pr-32')
    expect(wrapper.get('h1').text()).toBe('Dashboard')
  })

  it('keeps page actions on one line while allowing the action group to reflow', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Dashboard' },
      slots: { actions: '<button>Thử lại</button>' },
      global: { stubs: { NuxtLink: true, IconArrowLeft: true } },
    })

    expect(wrapper.get('[data-page-actions]').classes()).toContain('whitespace-nowrap')
  })

  it('can drop the desktop reservation inside a shell that already clears global actions', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Người dùng', reserveGlobalActions: false },
      global: { stubs: { NuxtLink: true, IconArrowLeft: true } },
    })

    expect(wrapper.classes()).not.toContain('lg:pr-44')
  })

  it('can hide the inline back link on desktop while keeping it on mobile', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Hồ sơ', backTo: '/dashboard/settings', backMobileOnly: true },
      global: { stubs: { NuxtLink: defineComponent({ template: '<a data-back><slot /></a>' }), IconArrowLeft: true } },
    })

    expect(wrapper.get('[data-back]').classes()).toContain('lg:hidden')
  })

  it('keeps the inline back link visible on desktop by default', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Chi tiết', backTo: '/dashboard' },
      global: { stubs: { NuxtLink: defineComponent({ template: '<a data-back><slot /></a>' }), IconArrowLeft: true } },
    })

    expect(wrapper.get('[data-back]').classes()).not.toContain('lg:hidden')
  })
})
