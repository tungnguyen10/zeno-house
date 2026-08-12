import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import UiPageHeader from '../../../app/components/ui/UiPageHeader.vue'

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

    expect(wrapper.classes()).toContain('lg:pr-32')
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
})
