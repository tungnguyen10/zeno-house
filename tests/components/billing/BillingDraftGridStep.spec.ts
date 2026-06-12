import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BillingDraftGridStep from '../../../app/components/billing/BillingDraftGridStep.vue'
import UiInput from '../../../app/components/ui/UiInput.vue'
import UiTable from '../../../app/components/ui/UiTable.vue'
import { buildPeriod } from '../../__fixtures__/billing/period'
import type { BillingDraftGridResponse, BillingDraftGridRow } from '~/types/billing'

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

function response(): BillingDraftGridResponse {
  return {
    period: buildPeriod(),
    batchReadingDate: '2026-05-31',
    rows: [
      buildRow({ roomId: 'room-1' }),
      buildRow({ roomId: 'room-2' }),
    ],
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

function mountGrid() {
  return mount(BillingDraftGridStep, {
    props: {
      response: response(),
      loading: false,
      period: buildPeriod(),
      onSaveReadings: vi.fn(),
      onSaveOverride: vi.fn(),
    },
    attachTo: document.body,
    global: {
      components: {
        UiInput,
        UiTable,
      },
      stubs: {
        UiSection: passthrough,
        UiToolbar: passthrough,
        UiButton: defineComponent({ template: '<button type="button"><slot /></button>' }),
        UiStatusBadge: empty,
        UiMetric: empty,
        UiModal: passthrough,
        UiAlert: passthrough,
        UiSelect: empty,
        UiEmptyState: empty,
        UiSkeleton: empty,
        BillingDraftDiscrepancyCallout: empty,
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
})
