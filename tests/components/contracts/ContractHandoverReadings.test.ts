import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContractHandoverReadings } from '~/composables/contracts/useContractHandoverReadings'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useContractHandoverReadings', useContractHandoverReadings)

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.stubGlobal('useToast', () => toast)

const readings = ref<unknown[]>([])
const prior = ref<unknown>({ data: { electricity: { readingValue: 10875, periodMonth: 10, periodYear: 2026 }, water: null } })
const refreshReadings = vi.fn(async () => {})
vi.stubGlobal('useFetch', (url: string) => url === '/api/meter-readings'
  ? { data: ref({ data: readings }), refresh: refreshReadings }
  : { data: prior, refresh: vi.fn() })

const handoverIn = (meterType: string, readingValue: number) => ({
  id: `r-${meterType}`, roomId: 'room-1', buildingId: 'b-1', contractId: 'c-1', meterType,
  readingType: 'handover_in', periodYear: 2026, periodMonth: 11, readingDate: '2026-11-20',
  readingValue, imageUrl: null, notes: null, recordedBy: null,
  createdAt: '2026-11-18T16:32:33.000Z', updatedAt: '2026-11-22T15:03:18.000Z',
})

const UiInput = defineComponent({
  props: { modelValue: [String, Number], error: String, disabled: Boolean },
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('div', [
    h('input', { value: props.modelValue, disabled: props.disabled, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }),
    props.error ? h('p', { class: 'input-error' }, props.error) : null,
  ]),
})
const UiModal = defineComponent({
  props: { open: Boolean, title: String },
  setup: (props, { slots }) => () => props.open
    ? h('div', { 'data-testid': 'modal' }, [h('h2', props.title), slots.default?.(), slots.footer?.()])
    : null,
})
const passthrough = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })

async function mountComponent() {
  const { default: C } = await import('~/components/contracts/ContractHandoverReadings.vue')
  const wrapper = mount(C, {
    props: { contractId: 'c-1', roomId: 'room-1', startDate: '2026-11-20', endDate: '2027-11-30', status: 'active' },
    global: { stubs: { UiInput, UiModal, UiDatePicker: true, UiAlert: passthrough, UiSkeleton: true } },
  })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountComponent>>, text: string) {
  const button = wrapper.findAll('button').find(b => b.text().includes(text))
  if (!button) throw new Error(`Button "${text}" not found`)
  return button
}

describe('ContractHandoverReadings', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
    readings.value = [handoverIn('electricity', 740), handoverIn('water', 224)]
    prior.value = { data: { electricity: { readingValue: 10875, periodMonth: 10, periodYear: 2026 }, water: null } }
  })

  it('does not save while typing', async () => {
    const wrapper = await mountComponent()
    await wrapper.findAll('input')[0]!.setValue('10875')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Chưa lưu')
  })

  it('shows when the saved reading was last stored', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.text()).toContain('Đã lưu')
  })

  it('shows saved readings that arrive after the first render', async () => {
    readings.value = []
    prior.value = null
    const wrapper = await mountComponent()
    readings.value = [handoverIn('electricity', 10875), handoverIn('water', 0)]
    await flushPromises()
    expect((wrapper.findAll('input')[0]!.element as HTMLInputElement).value).toBe('10875')
    expect(wrapper.text()).not.toContain('Chưa lưu')
  })

  it('confirms old -> new before saving exactly once', async () => {
    fetchMock.mockResolvedValue({ data: [] })
    const wrapper = await mountComponent()
    await wrapper.findAll('input')[0]!.setValue('10875')
    await buttonByText(wrapper, 'Lưu').trigger('click')

    const modal = wrapper.find('[data-testid="modal"]')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('740')
    expect(modal.text()).toContain('10.875')
    expect(modal.text()).toContain('Kỳ 11/2026')
    expect(fetchMock).not.toHaveBeenCalled()

    await buttonByText(wrapper, 'Lưu số bàn giao').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![1].body.readings[0]).toMatchObject({
      contract_id: 'c-1', meter_type: 'electricity', reading_type: 'handover_in', reading_value: 10875,
    })
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('10.875'))
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
  })

  it('warns in the confirmation when the value is below the latest room reading', async () => {
    const wrapper = await mountComponent()
    await wrapper.findAll('input')[0]!.setValue('740.5')
    await buttonByText(wrapper, 'Lưu').trigger('click')
    expect(wrapper.find('[data-testid="modal"]').text()).toContain('Thấp hơn số chốt 10/2026')
  })

  it('reverts to the saved value on cancel', async () => {
    const wrapper = await mountComponent()
    await wrapper.findAll('input')[0]!.setValue('999')
    await buttonByText(wrapper, 'Huỷ').trigger('click')
    expect((wrapper.findAll('input')[0]!.element as HTMLInputElement).value).toBe('740')
    expect(wrapper.text()).not.toContain('Chưa lưu')
  })

  it('keeps the typed value and reports the error on the row when saving fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'))
    const wrapper = await mountComponent()
    await wrapper.findAll('input')[0]!.setValue('10875')
    await buttonByText(wrapper, 'Lưu').trigger('click')
    await buttonByText(wrapper, 'Lưu số bàn giao').trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalled()
    expect(wrapper.find('.input-error').exists()).toBe(true)
    expect((wrapper.findAll('input')[0]!.element as HTMLInputElement).value).toBe('10875')
    expect(wrapper.text()).toContain('Chưa lưu')
  })
})
