import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import BuildingInvoiceEmailSettings from '../../../app/components/buildings/BuildingInvoiceEmailSettings.vue'

const stubs = {
  UiAlert: defineComponent({ template: '<div role="alert"><slot /></div>' }),
  UiBadge: defineComponent({ template: '<span><slot /></span>' }),
  UiButton: defineComponent({
    props: ['disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  }),
  UiModal: defineComponent({
    props: ['open', 'title'],
    emits: ['close'],
    template: '<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="footer" /></div>',
  }),
  UiSkeleton: defineComponent({ template: '<div />' }),
  UiToggle: defineComponent({
    props: ['modelValue', 'disabled', 'ariaLabel'],
    emits: ['update:modelValue'],
    template: '<button role="switch" :disabled="disabled" :aria-label="ariaLabel" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)">toggle</button>',
  }),
}

function settings(overrides = {}) {
  return {
    buildingId: 'building-1',
    autoSendEnabled: false,
    featureAvailable: true,
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  }
}

describe('BuildingInvoiceEmailSettings', () => {
  it('shows a read-only disabled state for managers', () => {
    const wrapper = mount(BuildingInvoiceEmailSettings, {
      props: {
        settings: settings(),
        canEdit: false,
        loading: false,
        saving: false,
        error: null,
      },
      global: { stubs },
    })

    expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('chỉ chủ sở hữu hoặc quản trị viên')
  })

  it('keeps the toggle disabled while the global feature is off', () => {
    const wrapper = mount(BuildingInvoiceEmailSettings, {
      props: {
        settings: settings({ featureAvailable: false }),
        canEdit: true,
        loading: false,
        saving: false,
        error: null,
      },
      global: { stubs },
    })

    expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Chưa mở trên hệ thống')
  })

  it('requires confirmation before enabling and disables immediately without confirmation', async () => {
    const wrapper = mount(BuildingInvoiceEmailSettings, {
      props: {
        settings: settings(),
        canEdit: true,
        loading: false,
        saving: false,
        error: null,
      },
      global: { stubs },
    })

    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('[role="dialog"] button:last-child').trigger('click')
    expect(wrapper.emitted('save')).toEqual([[true]])

    await wrapper.setProps({ settings: settings({ autoSendEnabled: true }) })
    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('save')).toEqual([[true], [false]])
  })
})
