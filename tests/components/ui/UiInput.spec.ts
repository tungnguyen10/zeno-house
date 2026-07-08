import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiInput from '~/components/ui/UiInput.vue'

describe('UiInput', () => {
  it('keeps caller class on the root and forwards native attrs to the input', () => {
    const wrapper = mount(UiInput, {
      props: {
        id: 'amount',
        modelValue: '10',
        type: 'number',
      },
      attrs: {
        class: 'w-32',
        name: 'amount',
        min: '1',
        max: '12',
        step: '2',
        autocomplete: 'off',
      },
    })

    const input = wrapper.get('input')
    expect(wrapper.classes()).toContain('w-32')
    expect(input.attributes('name')).toBe('amount')
    expect(input.attributes('min')).toBe('1')
    expect(input.attributes('max')).toBe('12')
    expect(input.attributes('step')).toBe('2')
    expect(input.attributes('autocomplete')).toBe('off')
  })

  it('emits strings by default and numbers when v-model.number is used', async () => {
    const plain = mount(UiInput, {
      props: { modelValue: '', type: 'number' },
    })
    await plain.get('input').setValue('12.5')
    expect(plain.emitted('update:modelValue')?.[0]).toEqual(['12.5'])

    const numeric = mount(UiInput, {
      props: {
        modelValue: '',
        type: 'number',
        modelModifiers: { number: true },
      },
    })
    await numeric.get('input').setValue('12.5')
    expect(numeric.emitted('update:modelValue')?.[0]).toEqual([12.5])
  })

  it('wires invalid state and described-by ids consistently', () => {
    const wrapper = mount(UiInput, {
      props: {
        id: 'email',
        modelValue: '',
        type: 'email',
        error: 'Email không hợp lệ',
      },
    })

    const input = wrapper.get('input')
    expect(wrapper.attributes('data-invalid')).toBe('')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('email-error')
    expect(wrapper.get('#email-error').text()).toBe('Email không hợp lệ')
  })

  it('applies type defaults and lets caller attrs override them', () => {
    const email = mount(UiInput, {
      props: { modelValue: '', type: 'email' },
    })
    expect(email.get('input').attributes('inputmode')).toBe('email')
    expect(email.get('input').attributes('autocomplete')).toBe('email')

    const month = mount(UiInput, {
      props: { modelValue: '', type: 'number', numberMode: 'month' },
    })
    expect(month.get('input').attributes('inputmode')).toBe('numeric')
    expect(month.get('input').attributes('min')).toBe('1')
    expect(month.get('input').attributes('max')).toBe('12')
    expect(month.get('input').attributes('step')).toBe('1')

    const custom = mount(UiInput, {
      props: { modelValue: '', type: 'number', numberMode: 'month' },
      attrs: { min: '0', max: '24', step: '3', inputmode: 'decimal' },
    })
    expect(custom.get('input').attributes('inputmode')).toBe('decimal')
    expect(custom.get('input').attributes('min')).toBe('0')
    expect(custom.get('input').attributes('max')).toBe('24')
    expect(custom.get('input').attributes('step')).toBe('3')
  })
})
