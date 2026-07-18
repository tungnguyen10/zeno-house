import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalButton from '~/components/portal/PortalButton.vue'

const stubs = { IconSpinner: true }

describe('PortalButton', () => {
  it('uses the refreshed primary and visible focus treatment', () => {
    const wrapper = mount(PortalButton, { global: { stubs } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'bg-theme',
      'active:scale-[0.98]',
      'focus-visible:ring-2',
      'focus-visible:ring-theme/40',
      'motion-reduce:transition-none',
    ]))
  })

  it('requires an accessible label for an icon-only button', () => {
    expect(() => mount(PortalButton, {
      props: { iconOnly: true },
      global: { stubs },
    })).toThrow('ariaLabel is required when iconOnly is true')
  })

  it('forwards the accessible label for an icon-only button', () => {
    const wrapper = mount(PortalButton, {
      props: { iconOnly: true, ariaLabel: 'Đóng' },
      global: { stubs },
    })
    expect(wrapper.attributes('aria-label')).toBe('Đóng')
  })

  it('disables the button and exposes busy state while loading', () => {
    const wrapper = mount(PortalButton, {
      props: { loading: true },
      global: { stubs },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })
})
