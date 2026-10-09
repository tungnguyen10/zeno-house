import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import AppHeader from '../../../app/components/app/AppHeader.vue'

const buttonStub = defineComponent({
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
})

const toggleTheme = vi.fn()

describe('AppHeader', () => {
  beforeEach(() => {
    toggleTheme.mockReset()
    vi.stubGlobal('useDashboardTheme', () => ({ resolvedTheme: ref('dark'), toggleTheme }))
    vi.stubGlobal('useAppHeaderBack', () => ref(null))
    vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  })

  it('renders global status actions before the account menu', () => {
    const wrapper = mount(AppHeader, {
      slots: {
        status: '<button data-test="status-action">Việc cần xử lý</button>',
      },
      global: {
        stubs: {
          UiButton: buttonStub,
          IconMenu: true,
          IconSun: true,
          IconMoon: true,
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
          IconSun: true,
          IconMoon: true,
          AppUserMenu: true,
        },
      },
    })

    expect(wrapper.classes()).toContain('h-16')
    expect(wrapper.classes()).toContain('lg:absolute')
    expect(wrapper.classes()).toContain('lg:h-auto')
    expect(wrapper.classes()).toContain('lg:border-0')
  })

  it('renders a 44px theme action before the account menu and toggles explicitly', async () => {
    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          UiButton: buttonStub,
          IconMenu: true,
          IconSun: true,
          IconMoon: true,
          AppUserMenu: defineComponent({ template: '<div data-test="user-menu" />' }),
        },
      },
    })

    const toggle = wrapper.get('[data-dashboard-theme-toggle]')
    const actions = wrapper.get('[data-global-actions]')

    expect(toggle.attributes('aria-label')).toBe('Chuyển sang giao diện sáng')
    expect(toggle.classes()).toContain('min-h-11')
    expect(toggle.classes()).toContain('min-w-11')
    expect(actions.element.children[actions.element.children.length - 2]).toBe(toggle.element)

    await toggle.trigger('click')
    expect(toggleTheme).toHaveBeenCalledOnce()
  })
})
