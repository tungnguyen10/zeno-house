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
    expect(wrapper.get('[role="dialog"]').text()).toContain('Tháng 7/2026')

    await wrapper.get('button[data-date="2026-07-15"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-07-15'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['2026-07-15'])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('applies date mode constraints and caller overrides', async () => {
    const future = mountDatePicker({
      modelValue: null,
      dateMode: 'future',
    })
    await future.get('button#paid-at').trigger('click')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    expect(future.get(`button[data-date="${yesterday}"]`).attributes('disabled')).toBeDefined()

    const custom = mountDatePicker({
      modelValue: '2026-07-15',
      dateMode: 'future',
      minDate: '2026-07-10',
    })
    await custom.get('button#paid-at').trigger('click')
    expect(custom.get('button[data-date="2026-07-09"]').attributes('disabled')).toBeDefined()
    expect(custom.get('button[data-date="2026-07-10"]').attributes('disabled')).toBeUndefined()
  })

  it('clears optional values', async () => {
    const wrapper = mountDatePicker({ required: false })

    await wrapper.get('button#paid-at').trigger('click')
    const clear = wrapper.findAll('button').find(button => button.text() === 'Xoá')
    expect(clear).toBeTruthy()
    await clear!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(wrapper.emitted('change')?.[0]).toEqual([''])
  })
})
