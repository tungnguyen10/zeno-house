import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import OperationsExpenseModal from '../../../app/components/operations-report/OperationsExpenseModal.vue'

const UiModal = defineComponent({
  props: ['open', 'title'],
  emits: ['close'],
  template: '<section v-if="open"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>',
})

const UiInput = defineComponent({
  props: ['modelValue', 'label', 'type'],
  emits: ['update:modelValue'],
  template: `
    <label>
      <span>{{ label }}</span>
      <input :type="type ?? 'text'" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
      <slot name="suffix" />
    </label>
  `,
})

const UiSelect = defineComponent({
  props: ['modelValue', 'label', 'options'],
  emits: ['update:modelValue'],
  template: `
    <label>
      <span>{{ label }}</span>
      <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </label>
  `,
})

const UiCombobox = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<label><span>{{ label }}</span><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></label>',
})

const UiButton = defineComponent({
  props: ['type', 'disabled'],
  emits: ['click'],
  template: '<button :type="type ?? \'button\'" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})

const passthrough = defineComponent({ template: '<div><slot /></div>' })
const icon = defineComponent({ template: '<span />' })

function mountModal() {
  return mount(OperationsExpenseModal, {
    props: {
      open: true,
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      canUseReserve: true,
    },
    global: {
      stubs: {
        UiModal,
        UiInput,
        UiSelect,
        UiCombobox,
        UiTextarea: passthrough,
        UiAlert: passthrough,
        UiButton,
        IconChevronDown: icon,
      },
    },
  })
}

describe('OperationsExpenseModal', () => {
  it('offers reserve deduction regardless of current balance and submits the funding source', async () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Trừ quỹ dự phòng')
    expect(wrapper.text()).toContain('số dư quỹ âm')

    await wrapper.findAll('input')[0]!.setValue('500000')
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      building_id: 'building-1',
      period_year: 2026,
      period_month: 7,
      amount: 500000,
      funded_by: 'reserve_fund',
    })
  })
})
