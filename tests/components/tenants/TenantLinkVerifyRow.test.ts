import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import TenantLinkVerifyRow from '~/components/tenants/TenantLinkVerifyRow.vue'

const inputStub = defineComponent({
  props: ['modelValue', 'density', 'placeholder', 'ariaLabel', 'disabled'],
  emits: ['update:modelValue', 'keydown'],
  template: '<div class="input-stub" :data-density="density"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keydown="$emit(\'keydown\', $event)" /></div>',
})
const buttonStub = defineComponent({
  props: ['size', 'disabled', 'loading', 'variant'],
  emits: ['click'],
  template: '<button type="button" :data-size="size" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
})

const mountRow = (props: Record<string, unknown> = {}) => mount(TenantLinkVerifyRow, {
  props: { phone: '0901234567', proof: '', ...props },
  global: { stubs: { UiInput: inputStub, UiButton: buttonStub } },
})

describe('TenantLinkVerifyRow', () => {
  it('uses touch-sized controls (normal density, md button) and stacks on narrow screens', () => {
    const w = mountRow()
    expect(w.get('.input-stub').attributes('data-density')).not.toBe('compact')
    expect(w.get('button').attributes('data-size')).toBe('md')
    const controls = w.get('[data-test="tenant-link-controls"]').classes()
    expect(controls).toContain('flex-col')
    expect(controls).toContain('sm:flex-row')
    expect(w.get('button').classes()).toContain('w-full')
    expect(w.get('button').classes()).toContain('sm:w-auto')
  })

  it('disables the action until a proof is typed and submits on click and Enter', async () => {
    const w = mountRow()
    expect(w.get('button').attributes('disabled')).toBeDefined()

    await w.setProps({ proof: '012345678901' })
    expect(w.get('button').attributes('disabled')).toBeUndefined()
    await w.get('button').trigger('click')
    await w.get('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')).toHaveLength(2)
  })

  it('reports typed proof through update:proof', async () => {
    const w = mountRow()
    await w.get('input').setValue('Lê C')
    expect(w.emitted('update:proof')!.at(-1)).toEqual(['Lê C'])
  })

  it('announces one error line with role alert', () => {
    const w = mountRow({ proof: 'x', error: 'Không khớp với hồ sơ khách' })
    const alert = w.get('[data-test="tenant-link-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toBe('Không khớp với hồ sơ khách')
  })

  it('locks inputs while verifying', () => {
    const w = mountRow({ proof: 'x', verifying: true })
    expect(w.get('button').attributes('disabled')).toBeDefined()
  })
})
