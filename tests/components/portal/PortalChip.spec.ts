import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalChip from '~/components/portal/PortalChip.vue'

describe('PortalChip', () => {
  it('renders a quiet informational label by default', () => {
    const wrapper = mount(PortalChip, { slots: { default: 'Khu A' } })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'rounded-full',
      'bg-smoke',
      'text-body',
    ]))
  })

  it('renders an interactive selected chip with pressed state and a named intent', async () => {
    const wrapper = mount(PortalChip, {
      props: { interactive: true, selected: true, tone: 'accent' },
      slots: { default: 'Ưu tiên' },
    })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    expect(wrapper.classes()).toContain('focus-visible:ring-2')

    await wrapper.trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('uses danger tone without making a non-interactive chip a button', () => {
    const wrapper = mount(PortalChip, { props: { tone: 'danger' } })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.classes()).toContain('text-portal-danger')
  })
})
