import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

const UiInputStub = defineComponent({
  props: ['modelValue', 'type', 'label'],
  emits: ['update:modelValue'],
  template: '<div><input :type="type" :value="modelValue"><slot name="suffix" /></div>',
})

describe('AuthPasswordField', () => {
  it('toggles visibility with an accessible label without changing the value', async () => {
    const component = (await import('../../../app/components/auth/AuthPasswordField.vue')).default
    const wrapper = mount(component, {
      props: { modelValue: 'secret-123', label: 'Mật khẩu' },
      global: { stubs: { UiInput: UiInputStub, IconEye: true, IconEyeOff: true } },
    })
    expect(wrapper.get('input').attributes('type')).toBe('password')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Ẩn mật khẩu')
    expect(wrapper.get('input').element.value).toBe('secret-123')
  })
})
