import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { afterEach, describe, expect, it } from 'vitest'
import UiDatePicker from '~/components/ui/UiDatePicker.vue'

function mountDatePicker(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(UiDatePicker, {
    attachTo: document.body,
    props: {
      id: 'paid-at',
      modelValue: '2026-07-08',
      label: 'Ngày thanh toán',
      ...props,
    },
    attrs,
    global: {
      stubs: {
        IconCalendar: true,
        IconChevronLeft: true,
        IconChevronRight: true,
      },
    },
  })
}

/** Panel is teleported to body; query it directly from the document. */
function panel(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

function panelButton(selector: string): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(selector)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UiDatePicker', () => {
  it('renders a formatted trigger and wires field state', () => {
    const wrapper = mountDatePicker(
      { error: 'Ngày không hợp lệ' },
      { class: 'w-48', 'aria-label': 'Chọn ngày thanh toán' },
    )

    const trigger = wrapper.get('button#paid-at')
    expect(wrapper.classes()).toContain('w-48')
    expect(wrapper.get('label').attributes('for')).toBe('paid-at')
    expect(trigger.text()).toContain('08/07/2026')
    expect(trigger.attributes('aria-label')).toBe('Chọn ngày thanh toán')
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(trigger.attributes('aria-describedby')).toBe('paid-at-error')
    expect(wrapper.attributes('data-invalid')).toBe('')
  })

  it('opens the calendar, selects an ISO date, and closes', async () => {
    const wrapper = mountDatePicker()

    await wrapper.get('button#paid-at').trigger('click')
    expect(panel()?.textContent ?? '').toContain('Tháng 7/2026')

    const day = panelButton('button[data-date="2026-07-15"]')
    day?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-07-15'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['2026-07-15'])
    expect(panel()).toBeNull()
  })

  it('applies date mode constraints and caller overrides', async () => {
    const future = mountDatePicker({
      modelValue: null,
      dateMode: 'future',
    })
    await future.get('button#paid-at').trigger('click')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    expect(panelButton(`button[data-date="${yesterday}"]`)?.hasAttribute('disabled')).toBe(true)
    future.unmount()

    const custom = mountDatePicker({
      modelValue: '2026-07-15',
      dateMode: 'future',
      minDate: '2026-07-10',
    })
    await custom.get('button#paid-at').trigger('click')
    expect(panelButton('button[data-date="2026-07-09"]')?.hasAttribute('disabled')).toBe(true)
    expect(panelButton('button[data-date="2026-07-10"]')?.hasAttribute('disabled')).toBe(false)
  })

  it('clears optional values', async () => {
    const wrapper = mountDatePicker({ required: false })

    await wrapper.get('button#paid-at').trigger('click')
    const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
    const clear = buttons.find(button => button.textContent?.trim() === 'Xoá')
    expect(clear).toBeTruthy()
    clear!.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(wrapper.emitted('change')?.[0]).toEqual([''])
  })

  it('supports month picker mode and emits YYYY-MM', async () => {
    const wrapper = mountDatePicker({
      modelValue: '2026-07',
      pickerMode: 'month',
      label: 'Tháng vận hành',
    })

    expect(wrapper.get('button#paid-at').text()).toContain('07/2026')

    await wrapper.get('button#paid-at').trigger('click')
    expect(panel()?.textContent ?? '').toContain('Năm 2026')

    panelButton('button[data-period="2026-09"]')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-09'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['2026-09'])
  })
})
