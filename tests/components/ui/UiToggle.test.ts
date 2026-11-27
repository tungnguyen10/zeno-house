import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiToggle from '~/components/ui/UiToggle.vue'

describe('UiToggle', () => {
  it('keeps the visible label as the accessible name when no ariaLabel is given', () => {
    const wrapper = mount(UiToggle, { props: { label: 'Cho phép xoá dữ liệu' } })

    expect(wrapper.get('button').attributes('aria-label')).toBeUndefined()
    expect(wrapper.text()).toContain('Cho phép xoá dữ liệu')
  })

  it('applies ariaLabel even when a visible label is shown', () => {
    const wrapper = mount(UiToggle, { props: { label: 'Cho phép xoá dữ liệu', ariaLabel: 'Cho phép xoá dữ liệu ở Zeno' } })

    expect(wrapper.get('button').attributes('aria-label')).toBe('Cho phép xoá dữ liệu ở Zeno')
    expect(wrapper.text()).toContain('Cho phép xoá dữ liệu')
  })

  it('applies ariaLabel when there is no visible label', () => {
    const wrapper = mount(UiToggle, { props: { ariaLabel: 'Bật' } })

    expect(wrapper.get('button').attributes('aria-label')).toBe('Bật')
  })

  it('emits the toggled value on click', async () => {
    const wrapper = mount(UiToggle, { props: { modelValue: false, ariaLabel: 'Bật' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })
})
