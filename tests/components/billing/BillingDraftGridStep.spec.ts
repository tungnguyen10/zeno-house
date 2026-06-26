import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BillingDraftGridStep from '../../../app/components/billing/BillingDraftGridStep.vue'
import BillingMobileDraftRow from '../../../app/components/billing/BillingMobileDraftRow.vue'
import UiCheckbox from '../../../app/components/ui/UiCheckbox.vue'
import UiInput from '../../../app/components/ui/UiInput.vue'
import UiTable from '../../../app/components/ui/UiTable.vue'
import { buildPeriod } from '../../__fixtures__/billing/period'
import type { BillingDraftGridResponse, BillingDraftGridRow } from '../../../app/types/billing'

function buildRow(overrides: Partial<BillingDraftGridRow> = {}): BillingDraftGridRow {
  const roomId = overrides.roomId ?? 'room-1'
  return {
    key: roomId,
    rowType: 'billable_contract',
    roomId,
    roomNumber: roomId === 'room-1' ? '101' : '102',
    floor: 1,
    contractId: `contract-${roomId}`,
    tenantId: `tenant-${roomId}`,
    tenantName: `Tenant ${roomId}`,
    contractCode: null,
    invoiceId: null,
    invoiceStatus: null,
    editable: true,
    status: 'missing_reading',
    electricity: {
      meterType: 'electricity',
      required: true,
      editable: true,
      previousReadingId: 'prev-e',
      previousValue: 100,
      currentReadingId: null,
      currentValue: null,
      readingDate: '2026-05-31',
      usage: null,
      rate: 4_000,
      amount: null,
      pricingType: 'per_kwh',
      overrideId: null,
      source: 'monthly',
      blockerCode: null,
    },
    water: {
      meterType: 'water',
      required: true,
      editable: true,
      previousReadingId: 'prev-w',
      previousValue: 10,
      currentReadingId: null,
      currentValue: null,
      readingDate: '2026-05-31',
      usage: null,
      rate: 15_000,
      amount: null,
      pricingType: 'per_m3',
      overrideId: null,
      source: 'monthly',
      blockerCode: null,
    },
    rentAndServiceTotal: 3_100_000,
    draftTotal: null,
    blockers: [],
    warnings: [],
    lines: [],
    ...overrides,
  }
}

function response(rows: BillingDraftGridRow[] = [
  buildRow({ roomId: 'room-1' }),
  buildRow({ roomId: 'room-2' }),
]): BillingDraftGridResponse {
  return {
    period: buildPeriod(),
    batchReadingDate: '2026-05-31',
    rows,
    totals: {
      requiredReadingCount: 4,
      completeReadingCount: 0,
      readyDraftCount: 0,
      blockedDraftCount: 2,
      draftTotal: 0,
    },
  }
}

const passthrough = defineComponent({ template: '<div><slot /><slot name="actions" /><slot name="footer" /></div>' })
const empty = defineComponent({ template: '<div><slot /></div>' })
const checkboxStub = defineComponent({
  name: 'UiCheckbox',
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">{{ label }}</label>',
})
const discrepancyCalloutStub = defineComponent({
  name: 'BillingDraftDiscrepancyCallout',
  emits: ['intent:adjustment', 'intent:void-reissue'],
  template: '<div data-test="discrepancy-callout" />',
})

function mountGrid(overrides: Partial<{
  response: BillingDraftGridResponse
  period: ReturnType<typeof buildPeriod>
  onSaveReadings: ReturnType<typeof vi.fn>
  onSaveOverride: ReturnType<typeof vi.fn>
}> = {}) {
  const onSaveReadings = overrides.onSaveReadings ?? vi.fn()
  const onSaveOverride = overrides.onSaveOverride ?? vi.fn()
  return mount(BillingDraftGridStep, {
    props: {
      response: overrides.response ?? response(),
      loading: false,
      period: overrides.period ?? buildPeriod(),
      onSaveReadings,
      onSaveOverride,
    },
    attachTo: document.body,
    global: {
      components: {
        BillingMobileDraftRow,
        UiCheckbox,
        UiInput,
        UiTable,
      },
      stubs: {
        UiSection: passthrough,
        UiToolbar: passthrough,
        UiButton: defineComponent({ template: '<button type="button"><slot /></button>' }),
        UiCheckbox: checkboxStub,
        UiStatusBadge: empty,
        UiMetric: empty,
        UiModal: passthrough,
        UiAlert: passthrough,
        UiSelect: empty,
        UiEmptyState: empty,
        UiSkeleton: empty,
        BillingBulkReadingEntryModal: empty,
        BillingDraftDiscrepancyCallout: discrepancyCalloutStub,
      },
    },
  })
}

describe('BillingDraftGridStep', () => {
  it('moves focus from electricity to water cell on Tab', async () => {
    const wrapper = mountGrid()
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')
    const water = wrapper.get('[data-reading-cell="room-1::water"] input')

    await electricity.trigger('focus')
    await electricity.trigger('keydown', { key: 'Tab' })
    await new Promise(resolve => setTimeout(resolve))

    expect(document.activeElement).toBe(water.element)
    wrapper.unmount()
  })

  it('pastes multiline values down the focused column', async () => {
    const wrapper = mountGrid()
    const first = wrapper.get('[data-reading-cell="room-1::electricity"] input')
    const second = wrapper.get('[data-reading-cell="room-2::electricity"] input')

    await first.trigger('paste', {
      clipboardData: {
        getData: () => '123\n456',
      },
    })

    expect((first.element as HTMLInputElement).value).toBe('123')
    expect((second.element as HTMLInputElement).value).toBe('456')
    wrapper.unmount()
  })

  it('pasted values auto-save through the no-refresh path', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {})
    const wrapper = mountGrid({ onSaveReadings })
    const first = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await first.trigger('paste', {
      clipboardData: {
        getData: () => '123\n456',
      },
    })
    await vi.advanceTimersByTimeAsync(801)

    expect(onSaveReadings).toHaveBeenCalledTimes(2)
    expect(onSaveReadings).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ room_id: 'room-1', meter_type: 'electricity', reading_value: 123 })],
      { refresh: false, refreshDrafts: false, silent: true },
    )
    expect(onSaveReadings).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ room_id: 'room-2', meter_type: 'electricity', reading_value: 456 })],
      { refresh: false, refreshDrafts: false, silent: true },
    )
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('renders a stacked mobile row layout for the same draft rows', () => {
    const wrapper = mountGrid()

    const mobileRows = wrapper.findAllComponents(BillingMobileDraftRow)
    expect(mobileRows).toHaveLength(2)
    expect(wrapper.find('.md\\:hidden').exists()).toBe(true)

    wrapper.unmount()
  })

  it('auto-saves only changed reading cells for a row', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {})
    const wrapper = mountGrid({ onSaveReadings })
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('123')
    await vi.advanceTimersByTimeAsync(801)

    expect(onSaveReadings).toHaveBeenCalledTimes(1)
    expect(onSaveReadings).toHaveBeenCalledWith(
      [expect.objectContaining({
        room_id: 'room-1',
        meter_type: 'electricity',
        period_year: 2026,
        period_month: 5,
        reading_type: 'monthly',
        reading_value: 123,
      })],
      { refresh: false, refreshDrafts: false, silent: true },
    )
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('does not auto-save when an edited value matches the stored reading', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {})
    const row = buildRow({
      electricity: {
        ...buildRow().electricity!,
        currentValue: 123,
      },
    })
    const wrapper = mountGrid({ response: response([row]), onSaveReadings })
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('123')
    await vi.advanceTimersByTimeAsync(801)

    expect(onSaveReadings).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Mọi thay đổi đã được tự động lưu.')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('shows optimistic utility amount and row total while editing', async () => {
    const wrapper = mountGrid()
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('123')

    expect(wrapper.text()).toContain('92.000')
    expect(wrapper.text()).toContain('3.192.000')
    wrapper.unmount()
  })

  it('keeps optimistic amounts visible after auto-save succeeds without grid reload', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {})
    const wrapper = mountGrid({ onSaveReadings })
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('123')
    // Optimistic display visible before save
    expect(wrapper.text()).toContain('92.000')

    // Auto-save fires — must NOT wipe the optimistic display
    await vi.advanceTimersByTimeAsync(801)
    await wrapper.vm.$nextTick()

    expect(onSaveReadings).toHaveBeenCalledTimes(1)
    expect((electricity.element as HTMLInputElement).value).toBe('123')
    // Amounts still show after save (savedReadings keeps them until server refresh)
    expect(wrapper.text()).toContain('92.000')
    expect(wrapper.text()).toContain('3.192.000')

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('can auto-save back to the original prop value after a no-refresh save', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {})
    const row = buildRow({
      electricity: {
        ...buildRow().electricity!,
        currentValue: 123,
      },
    })
    const wrapper = mountGrid({ response: response([row]), onSaveReadings })
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('124')
    await vi.advanceTimersByTimeAsync(801)
    expect(onSaveReadings).toHaveBeenCalledTimes(1)

    await electricity.setValue('123')
    await vi.advanceTimersByTimeAsync(801)

    expect(onSaveReadings).toHaveBeenCalledTimes(2)
    expect(onSaveReadings).toHaveBeenLastCalledWith(
      [expect.objectContaining({ room_id: 'room-1', meter_type: 'electricity', reading_value: 123 })],
      { refresh: false, refreshDrafts: false, silent: true },
    )

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('keeps local input visible when auto-save fails', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {
      throw new Error('save failed')
    })
    const wrapper = mountGrid({ onSaveReadings })
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('123')
    await vi.advanceTimersByTimeAsync(801)

    expect((electricity.element as HTMLInputElement).value).toBe('123')
    expect(wrapper.text()).toContain('Lỗi')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('preserves failed local values, then clears the row error when editing resumes', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi
      .fn()
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValue(undefined)
    const wrapper = mountGrid({ onSaveReadings })
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')

    await electricity.setValue('123')
    await vi.advanceTimersByTimeAsync(801)
    expect((electricity.element as HTMLInputElement).value).toBe('123')
    expect(wrapper.text()).toContain('Lỗi')

    await electricity.setValue('124')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Lỗi')

    await vi.advanceTimersByTimeAsync(801)
    expect(onSaveReadings).toHaveBeenCalledTimes(2)
    expect(onSaveReadings).toHaveBeenLastCalledWith(
      [expect.objectContaining({ room_id: 'room-1', meter_type: 'electricity', reading_value: 124 })],
      { refresh: false, refreshDrafts: false, silent: true },
    )
    expect((electricity.element as HTMLInputElement).value).toBe('124')

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('keeps closed-period rows read-only without normal override actions', () => {
    const closedRow = buildRow({
      editable: false,
      status: 'ready',
      electricity: {
        ...buildRow().electricity!,
        editable: false,
        currentValue: 125,
        amount: 100_000,
      },
      water: {
        ...buildRow().water!,
        editable: false,
        currentValue: 18,
        amount: 120_000,
      },
      draftTotal: 3_320_000,
    })
    const wrapper = mountGrid({
      period: buildPeriod({ status: 'closed' }),
      response: response([closedRow]),
    })

    expect(wrapper.find('[data-reading-cell="room-1::electricity"] input').exists()).toBe(false)
    expect(wrapper.find('[data-reading-cell="room-1::water"] input').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Điều chỉnh chỉ số')

    wrapper.unmount()
  })

  it('bulk apply populates cells, highlights them, and schedules row auto-save without full grid reload', async () => {
    vi.useFakeTimers()
    const onSaveReadings = vi.fn(async () => {})
    const wrapper = mountGrid({ onSaveReadings })

    // Call applyBulkReadings via defineExpose — simulates the @apply emit from the modal.
    wrapper.vm.applyBulkReadings([
      { row: buildRow({ roomId: 'room-1' }), type: 'electricity', value: '130' },
      { row: buildRow({ roomId: 'room-1' }), type: 'water', value: '15' },
    ])
    await wrapper.vm.$nextTick()

    // Cells should reflect the applied values immediately
    const electricity = wrapper.get('[data-reading-cell="room-1::electricity"] input')
    const water = wrapper.get('[data-reading-cell="room-1::water"] input')
    expect((electricity.element as HTMLInputElement).value).toBe('130')
    expect((water.element as HTMLInputElement).value).toBe('15')

    // After debounce, row saves through the no-refresh path
    await vi.advanceTimersByTimeAsync(801)
    expect(onSaveReadings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ room_id: 'room-1', meter_type: 'electricity', reading_value: 130 }),
        expect.objectContaining({ room_id: 'room-1', meter_type: 'water', reading_value: 15 }),
      ]),
      { refresh: false, refreshDrafts: false, silent: true },
    )
    // Must NOT have triggered a full grid reload (refresh: true call)
    expect(onSaveReadings).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refresh: true }),
    )

    // After auto-save, the input values and optimistic amounts must remain
    // visible (via savedReadings) — not revert to server nulls.
    await wrapper.vm.$nextTick()
    expect((electricity.element as HTMLInputElement).value).toBe('130')
    expect((water.element as HTMLInputElement).value).toBe('15')
    // Optimistic electricity: (130-100)=30 kWh * 4000 = 120,000; water: (15-10)=5 m³ * 15000 = 75,000
    expect(wrapper.text()).toContain('120.000')
    expect(wrapper.text()).toContain('75.000')

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('forwards discrepancy intents from expanded rows', async () => {
    const wrapper = mountGrid({
      response: response([
        buildRow({
          draftTotal: 3_400_000,
          existingInvoice: {
            id: 'invoice-1',
            totalAmount: 3_100_000,
            paidAmount: 0,
            status: 'issued',
          },
        }),
      ]),
    })

    const expandButton = wrapper.findAll('button').find(button => button.attributes('aria-label') === 'Xem chi tiết')
    expect(expandButton).toBeTruthy()
    await expandButton!.trigger('click')

    const callout = wrapper.findComponent({ name: 'BillingDraftDiscrepancyCallout' })
    expect(callout.exists()).toBe(true)
    callout.vm.$emit('intent:adjustment', {
      invoiceId: 'invoice-1',
      amount: -300_000,
      label: 'Điều chỉnh do override tiêu thụ',
    })
    callout.vm.$emit('intent:void-reissue', { invoiceId: 'invoice-1' })

    expect(wrapper.emitted('intent:adjustment')?.[0]).toEqual([
      {
        invoiceId: 'invoice-1',
        amount: -300_000,
        label: 'Điều chỉnh do override tiêu thụ',
      },
    ])
    expect(wrapper.emitted('intent:void-reissue')?.[0]).toEqual([{ invoiceId: 'invoice-1' }])

    wrapper.unmount()
  })

  it('submits the same override payload from the row override modal', async () => {
    const onSaveOverride = vi.fn(async () => {})
    const row = buildRow({
      electricity: {
        ...buildRow().electricity!,
        currentReadingId: 'curr-e',
        currentValue: 125,
      },
      water: null,
    })
    const wrapper = mountGrid({ response: response([row]), onSaveOverride })

    const overrideButton = wrapper.findAll('button').find(button => button.text() === 'Điều chỉnh chỉ số')
    expect(overrideButton).toBeTruthy()
    await overrideButton!.trigger('click')
    await wrapper.vm.$nextTick()

    const modalInputs = wrapper.findAllComponents(UiInput).slice(-6)
    modalInputs[1]!.vm.$emit('update:modelValue', '150')
    modalInputs[2]!.vm.$emit('update:modelValue', '130')
    modalInputs[3]!.vm.$emit('update:modelValue', '10')
    modalInputs[5]!.vm.$emit('update:modelValue', 'Thay đồng hồ trong kỳ')
    await wrapper.vm.$nextTick()

    const saveButton = wrapper.findAll('button').find(button => button.text() === 'Lưu điều chỉnh')
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')

    expect(onSaveOverride).toHaveBeenCalledTimes(1)
    expect(onSaveOverride).toHaveBeenCalledWith({
      room_id: 'room-1',
      meter_type: 'electricity',
      previous_reading_id: 'prev-e',
      previous_reading_value: 100,
      current_reading_id: 'curr-e',
      current_reading_value: 150,
      old_meter_final_value: 130,
      new_meter_start_value: 10,
      billable_usage: 170,
      reason: 'replacement',
      note: 'Thay đồng hồ trong kỳ',
    })

    wrapper.unmount()
  })
})
