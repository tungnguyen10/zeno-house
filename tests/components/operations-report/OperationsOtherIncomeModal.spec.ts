import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OperationsOtherIncomeModal from '~/components/operations-report/OperationsOtherIncomeModal.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiAlert from '~/components/ui/UiAlert.vue'

const buildingId = '11111111-1111-4111-8111-111111111111'
const modalStub = { template: '<div><slot/><footer><slot name="footer"/></footer></div>' }
const dateStub = {
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<label>{{label}}<input type="date" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>',
}
function modal(canUseReserve = true) {
  return mount(OperationsOtherIncomeModal, {
    props: { buildingId, periodYear: 2026, periodMonth: 7, canUseReserve },
    global: {
      components: { UiInput, UiAlert },
      stubs: {
        UiModal: modalStub, UiDatePicker: dateStub, UiSelect: true, UiTextarea: true,
        IconChevronDown: true, IconSpinner: true,
      },
    },
  })
}

async function fill(wrapper: ReturnType<typeof modal>) {
  const fields = wrapper.findAllComponents(UiInput)
  await fields.find(field => field.props('label') === 'Tên khoản thu')!.find('input').setValue('Thanh lý máy bơm')
  await fields.find(field => field.props('label') === 'Số tiền')!.find('input').setValue('250000')
  await wrapper.get('input[type=date]').setValue('2026-07-28')
}

describe('OperationsOtherIncomeModal', () => {
  afterEach(() => vi.useRealTimers())

  it('uses today in Vietnam only in the selected month and defaults to one reserve allocation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-30T18:00:00Z'))
    const wrapper = modal()
    expect(wrapper.get<HTMLInputElement>('input[type=date]').element.value).toBe('2026-07-01')
    expect(wrapper.get<HTMLInputElement>('input[value=reserve_fund]').element.checked).toBe(true)
    await wrapper.get('input[value=profit]').setValue()
    expect(wrapper.get<HTMLInputElement>('input[value=reserve_fund]').element.checked).toBe(false)
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    expect(modal().get<HTMLInputElement>('input[type=date]').element.value).toBe('')
  })

  it('requires an explicit profit choice for a writer without reserve permission', async () => {
    const request = vi.fn().mockResolvedValue({ data: {} })
    vi.stubGlobal('$fetch', request)
    const wrapper = modal(false)
    await fill(wrapper)
    expect(wrapper.get<HTMLInputElement>('input[value=reserve_fund]').element.checked).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(request).not.toHaveBeenCalled()
    await wrapper.get('input[value=profit]').setValue()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/building-other-incomes', expect.objectContaining({
      method: 'POST', body: expect.objectContaining({ amount: 250000, allocation_target: 'profit', building_id: buildingId }),
    }))
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('retains the draft and operation ID and requires confirmation after a duplicate warning', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce({ data: { error: { code: 'CONFLICT', details: { reason: 'OTHER_INCOME_DUPLICATE' } } } })
      .mockResolvedValueOnce({ data: {} })
    vi.stubGlobal('$fetch', request)
    const wrapper = modal()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(request).toHaveBeenCalledTimes(1)
    await wrapper.get('input[type=checkbox]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const first = request.mock.calls[0]![1].body
    expect(request.mock.calls[1]![1].body).toMatchObject({ ...first, confirm_duplicate: true })
    expect(first.operation_id).toBeTruthy()
  })

  it('retains data and explains how to reload when the period closes mid-save', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ data: { error: { code: 'CONFLICT', details: { reason: 'OTHER_INCOME_PERIOD_CLOSED' } } } }))
    const wrapper = modal()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toMatch(/tải lại/i)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('input[type=date]').element.value).toBe('2026-07-28')
  })
})
