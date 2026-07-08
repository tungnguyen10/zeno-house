import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UiCombobox from '~/components/ui/UiCombobox.vue'

interface Option {
  id: string
  label: string
}

const options: Option[] = [
  { id: 'one', label: 'Một' },
  { id: 'two', label: 'Hai' },
]

function mountCombobox(modelValue: Option | null = options[0]!) {
  return mount(UiCombobox<Option>, {
    attachTo: document.body,
    props: {
      modelValue,
      options,
      optionKey: option => option.id,
      optionLabel: option => option.label,
      label: 'Lựa chọn',
    },
    global: {
      stubs: {
        IconCheckSmall: true,
        IconChevronDown: true,
        IconPlus: true,
        IconSpinner: true,
        IconX: true,
      },
    },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UiCombobox', () => {
  it('does not nest the clear button inside the combobox trigger', () => {
    const wrapper = mountCombobox()
    const trigger = wrapper.get('[role="combobox"]')

    expect(trigger.find('button').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Xóa lựa chọn"]').exists()).toBe(true)
  })

  it('clears the value without opening the dropdown', async () => {
    const wrapper = mountCombobox()

    await wrapper.get('button[aria-label="Xóa lựa chọn"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('closes on Escape and emits the selected option', async () => {
    const wrapper = mountCombobox(null)

    await wrapper.get('[role="combobox"]').trigger('click')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    await wrapper.get('input[type="text"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    await wrapper.get('[role="combobox"]').trigger('click')
    await wrapper.findAll('[role="option"]')[1]!.trigger('mousedown')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([options[1]])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })
})
