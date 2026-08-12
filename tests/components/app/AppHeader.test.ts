import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import AppHeader from '../../../app/components/app/AppHeader.vue'

const buttonStub = defineComponent({
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
})

describe('AppHeader', () => {
  it('renders global status actions before the account menu', () => {
    const wrapper = mount(AppHeader, {
      slots: {
        status: '<button data-test="status-action">Việc cần xử lý</button>',
      },
      global: {
        stubs: {
          UiButton: buttonStub,
          IconMenu: true,
          AppUserMenu: defineComponent({ template: '<div data-test="user-menu" />' }),
        },
      },
    })

    expect(wrapper.get('[data-test="status-action"]').exists()).toBe(true)
    expect(wrapper.get('[data-global-actions]').classes()).toContain('pointer-events-auto')
  })

  it('keeps the mobile shell row but becomes an overlay action rail on desktop', () => {
    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          UiButton: buttonStub,
          IconMenu: true,
          AppUserMenu: true,
        },
      },
    })

    expect(wrapper.classes()).toContain('h-16')
    expect(wrapper.classes()).toContain('lg:absolute')
    expect(wrapper.classes()).toContain('lg:h-auto')
    expect(wrapper.classes()).toContain('lg:border-0')
  })
})
