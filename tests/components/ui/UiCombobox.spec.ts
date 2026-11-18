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

  it('emits typed queries instead of filtering server-backed options locally', async () => {
    const wrapper = mountCombobox(null)
    await wrapper.setProps({ remoteSearch: true })

    await wrapper.get('[role="combobox"]').trigger('click')
    await wrapper.get('input[type="text"]').setValue('ngoài trang đầu')

    expect(wrapper.emitted('search')?.at(-1)).toEqual(['ngoài trang đầu'])
    expect(wrapper.findAll('[role="option"]')).toHaveLength(options.length)
  })

  it('renders the footer slot inside the open popup so it is never covered by it', async () => {
    const wrapper = mount(UiCombobox<Option>, {
      attachTo: document.body,
      props: { modelValue: null, options, optionKey: o => o.id, optionLabel: o => o.label },
      slots: { footer: '<div data-test="footer-slot">Xác minh</div>' },
      global: { stubs: { IconCheckSmall: true, IconChevronDown: true, IconPlus: true, IconSpinner: true, IconX: true } },
    })
    expect(wrapper.find('[data-test="footer-slot"]').exists()).toBe(false)

    await wrapper.get('[role="combobox"]').trigger('click')

    const footer = wrapper.get('[data-test="footer-slot"]')
    expect(footer.element.closest('[role="listbox"]')).toBeNull()
    expect(wrapper.get('.absolute.z-50').element.contains(footer.element)).toBe(true)
  })

  it('lets the footer slot close the popup and receive the typed query', async () => {
    const wrapper = mount(UiCombobox<Option>, {
      attachTo: document.body,
      props: { modelValue: null, options, optionKey: o => o.id, optionLabel: o => o.label },
      slots: {
        footer: `<template #footer="{ close, query }"><button data-test="footer-close" @click="close">{{ query }}</button></template>`,
      },
      global: { stubs: { IconCheckSmall: true, IconChevronDown: true, IconPlus: true, IconSpinner: true, IconX: true } },
    })
    await wrapper.get('[role="combobox"]').trigger('click')
    await wrapper.get('input[type="text"]').setValue('0901')
    expect(wrapper.get('[data-test="footer-close"]').text()).toBe('0901')

    await wrapper.get('[data-test="footer-close"]').trigger('click')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('keeps the popup open when interacting inside the footer slot', async () => {
    const wrapper = mount(UiCombobox<Option>, {
      attachTo: document.body,
      props: { modelValue: null, options, optionKey: o => o.id, optionLabel: o => o.label },
      slots: { footer: '<input data-test="footer-input" />' },
      global: { stubs: { IconCheckSmall: true, IconChevronDown: true, IconPlus: true, IconSpinner: true, IconX: true } },
    })
    await wrapper.get('[role="combobox"]').trigger('click')
    wrapper.get('[data-test="footer-input"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
  })
})
