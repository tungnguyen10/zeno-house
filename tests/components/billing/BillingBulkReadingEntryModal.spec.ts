import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import BillingBulkReadingEntryModal from '../../../app/components/billing/BillingBulkReadingEntryModal.vue'
import type { BillingDraftGridRow } from '../../../app/types/billing'

function row(overrides: Partial<BillingDraftGridRow> = {}): BillingDraftGridRow {
  const roomId = overrides.roomId ?? 'room-1'
  return {
    key: roomId,
    rowType: 'billable_contract',
    roomId,
    roomNumber: overrides.roomNumber ?? 'A101',
    floor: 1,
    contractId: `contract-${roomId}`,
    tenantId: `tenant-${roomId}`,
    tenantName: null,
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
      readingDate: null,
      usage: null,
      rate: 4000,
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
      readingDate: null,
      usage: null,
      rate: 15000,
      amount: null,
      pricingType: 'per_m3',
      overrideId: null,
      source: 'monthly',
      blockerCode: null,
    },
    rentAndServiceTotal: 0,
    draftTotal: null,
    blockers: [],
    warnings: [],
    lines: [],
    ...overrides,
  }
}

const UiModal = defineComponent({
  props: ['open'],
  template: '<div v-if="open"><slot /><slot name="footer" /></div>',
})

const UiTextarea = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})

const UiButton = defineComponent({
  props: ['disabled'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
})

const UiAlert = defineComponent({ template: '<div><slot /></div>' })

const UiTable = defineComponent({
  props: ['rows', 'columns'],
  template: `
    <table>
      <tbody>
        <tr v-for="row in rows" :key="row.lineNumber">
          <td v-for="col in columns" :key="col.key">
            <slot :name="'cell-' + col.key" :row="row">{{ row[col.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  `,
})

function mountModal(rows: BillingDraftGridRow[]) {
  return mount(BillingBulkReadingEntryModal, {
    props: { open: true, rows },
    global: {
      components: { UiModal, UiTextarea, UiButton, UiAlert, UiTable },
    },
  })
}

describe('BillingBulkReadingEntryModal', () => {
  it('previews room-number input and emits accepted updates', async () => {
    const wrapper = mountModal([
      row({ roomNumber: 'A101', roomId: 'r1' }),
      row({ roomNumber: 'A102', roomId: 'r2' }),
    ])

    await wrapper.get('textarea').setValue('A101 123 12\nA102')

    expect(wrapper.text()).toContain('A101')
    expect(wrapper.text()).toContain('Bỏ qua phòng này')

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1]!.trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject([
      { type: 'electricity', value: '123' },
      { type: 'water', value: '12' },
    ])
  })

  it('blocks apply when preview contains invalid values', async () => {
    const wrapper = mountModal([row({ roomNumber: 'A101' })])

    await wrapper.get('textarea').setValue('A101 abc 12')

    const buttons = wrapper.findAll('button')
    expect((buttons[buttons.length - 1]!.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Cần kiểm tra lại')
  })
})
