import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalTextField from '~/components/portal/PortalTextField.vue'

describe('PortalTextField', () => {
  it('associates its visible label with the native control', () => {
    const wrapper = mount(PortalTextField, {
      props: { modelValue: '', label: 'Email', id: 'email' },
    })
    expect(wrapper.get('label').attributes('for')).toBe('email')
    expect(wrapper.get('input').attributes('id')).toBe('email')
  })

  it('wires error feedback to the control with portal danger styling', () => {
    const wrapper = mount(PortalTextField, {
      props: { modelValue: '', label: 'Email', id: 'email', error: 'Email không hợp lệ.' },
    })
    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('email-error')
    expect(input.classes()).toContain('border-portal-danger')
    expect(wrapper.get('#email-error').classes()).toContain('text-portal-danger')
  })

  it('emits textarea changes through the same primitive contract', async () => {
    const wrapper = mount(PortalTextField, {
      props: { modelValue: '', label: 'Mô tả', textarea: true },
    })
    await wrapper.get('textarea').setValue('Vòi nước bị rò rỉ')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Vòi nước bị rò rỉ']])
  })

  it('supports disabled fields', () => {
    const wrapper = mount(PortalTextField, {
      props: { modelValue: '', label: 'Email', disabled: true },
    })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
  })

  it('uses AA body text for visible hint copy', () => {
    const wrapper = mount(PortalTextField, {
      props: { modelValue: '', label: 'Email', hint: 'Dùng email bạn thường kiểm tra.' },
    })

    expect(wrapper.get('p').classes()).toContain('text-body')
  })
})
