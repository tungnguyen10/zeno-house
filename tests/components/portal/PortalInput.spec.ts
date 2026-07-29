import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalInput from '~/components/portal/PortalInput.vue'

describe('PortalInput', () => {
  it('connects invalid feedback to its text control', () => {
    const wrapper = mount(PortalInput, {
      props: {
        modelValue: '',
        label: 'Số điện thoại',
        error: 'Số điện thoại không hợp lệ.',
      },
    })

    const input = wrapper.find('input')
    const feedback = wrapper.find('[role="alert"]')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(feedback.attributes('id'))
    expect(feedback.text()).toBe('Số điện thoại không hợp lệ.')
  })

  it('emits the changed value and exposes disabled state', async () => {
    const wrapper = mount(PortalInput, {
      props: { modelValue: '', label: 'Ghi chú', disabled: true },
    })

    expect(wrapper.attributes('data-disabled')).toBeDefined()
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ disabled: false })
    await wrapper.find('input').setValue('Đã cập nhật')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Đã cập nhật']])
  })

  it('renders a textarea with the same accessible feedback contract', () => {
    const wrapper = mount(PortalInput, {
      props: {
        modelValue: '',
        label: 'Ghi chú',
        textarea: true,
        hint: 'Tối đa 500 ký tự.',
      },
    })

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('textarea').attributes('aria-describedby')).toBe(wrapper.find('p').attributes('id'))
  })

  it('reserves feedback space and forwards blur from the control', async () => {
    const wrapper = mount(PortalInput, {
      props: { modelValue: '', label: 'Họ và tên' },
    })

    const feedback = wrapper.get('[data-feedback]')
    expect(feedback.classes()).toContain('min-h-[1rem]')
    expect(feedback.attributes('aria-hidden')).toBe('true')

    await wrapper.get('input').trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })
})
