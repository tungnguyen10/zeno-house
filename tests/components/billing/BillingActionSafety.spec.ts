import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import BillingCloseStep from '../../../app/components/billing/BillingCloseStep.vue'
import BillingIssueStep from '../../../app/components/billing/BillingIssueStep.vue'
import { buildPeriod } from '../../__fixtures__/billing/period'
import type { BillingDraftInvoice, BillingDraftResponse, BillingWorkspaceOverview } from '../../../app/types/billing'

function draft(overrides: Partial<BillingDraftInvoice> = {}): BillingDraftInvoice {
  return {
    contractId: 'contract-1',
    contractCode: 'HD-001',
    roomId: 'room-1',
    roomNumber: '101',
    tenantId: 'tenant-1',
    tenantName: 'Tenant One',
    periodId: 'period-1',
    existingInvoiceId: null,
    existingInvoiceStatus: null,
    existingInvoice: null,
    subtotalAmount: 3_100_000,
    discountAmount: 0,
    surchargeAmount: 0,
    totalAmount: 3_100_000,
    lines: [],
    blockers: [],
    warnings: [],
    ...overrides,
  }
}

function draftResponse(): BillingDraftResponse {
  return {
    period: buildPeriod(),
    drafts: [draft()],
    totals: { draftTotal: 3_100_000, blockedDraftCount: 0, issuableDraftCount: 1 },
  }
}

function overview(): BillingWorkspaceOverview {
  return {
    period: buildPeriod(),
    buildingId: 'building-1',
    buildingName: 'Building',
    contractCount: 1,
    invoiceCount: 1,
    readingCompleteCount: 2,
    readingRequiredCount: 2,
    draftTotal: 0,
    issuedTotal: 3_100_000,
    paidTotal: 3_100_000,
    outstandingBalance: 0,
    auditEvents: [],
  }
}

const passthrough = defineComponent({ template: '<div><slot /><slot name="actions" /><slot name="footer" /></div>' })
const alertStub = defineComponent({ template: '<div role="alert"><slot /></div>' })
const buttonStub = defineComponent({
  props: ['disabled'],
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
})
const confirmStub = defineComponent({
  props: ['open', 'loading'],
  emits: ['confirm', 'cancel'],
  template: `
    <div v-if="open" data-test="confirm-modal">
      <button type="button" data-test="confirm" :disabled="loading" @click="$emit('confirm')">confirm</button>
      <button type="button" data-test="cancel" @click="$emit('cancel')">cancel</button>
    </div>
  `,
})
const tableStub = defineComponent({
  props: ['rows', 'columns'],
  setup(props, { slots }) {
    return () => h('div', (props.rows as BillingDraftInvoice[]).map(row =>
      h('div', { 'data-test': `draft-${row.contractId}` }, [
        ...(props.columns as Array<{ key: string }>).map(column =>
          h('div', slots[`cell-${column.key}`]?.({ row }) ?? String(row[column.key as keyof BillingDraftInvoice] ?? '')),
        ),
      ]),
    ))
  },
})
const checkboxStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">',
})

function buttonWithText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().includes(text))
  if (!button) throw new Error(`Missing button: ${text}`)
  return button
}

describe('billing action confirmation safety', () => {
  it('clears issue selection only after the mutation succeeds', async () => {
    const onIssue = vi.fn(async () => ({ issuedCount: 1, invoices: [] }))
    const wrapper = mount(BillingIssueStep, {
      props: { drafts: draftResponse(), loading: false, onIssue },
      global: {
        stubs: {
          UiSection: passthrough,
          UiButton: buttonStub,
          UiAlert: alertStub,
          UiMetric: passthrough,
          UiTable: tableStub,
          UiCheckbox: checkboxStub,
          UiConfirmModal: confirmStub,
          UiSkeleton: passthrough,
        },
      },
    })

    await wrapper.get('input[type="checkbox"]').setValue(true)
    await buttonWithText(wrapper, 'Phát hành').trigger('click')
    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)

    await wrapper.get('[data-test="confirm"]').trigger('click')
    await flushPromises()

    expect(onIssue).toHaveBeenCalledWith({ contract_ids: ['contract-1'] })
    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(false)
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('keeps issue modal and selected rows when the mutation fails', async () => {
    const onIssue = vi.fn(async () => {
      throw new Error('server said no')
    })
    const wrapper = mount(BillingIssueStep, {
      props: { drafts: draftResponse(), loading: false, onIssue },
      global: {
        stubs: {
          UiSection: passthrough,
          UiButton: buttonStub,
          UiAlert: alertStub,
          UiMetric: passthrough,
          UiTable: tableStub,
          UiCheckbox: checkboxStub,
          UiConfirmModal: confirmStub,
          UiSkeleton: passthrough,
        },
      },
    })

    await wrapper.get('input[type="checkbox"]').setValue(true)
    await buttonWithText(wrapper, 'Phát hành').trigger('click')
    await wrapper.get('[data-test="confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('Phát hành thất bại')
  })

  it('keeps close confirmation recoverable when the mutation fails', async () => {
    const onClosePeriod = vi.fn(async () => {
      throw new Error('still has debt')
    })
    const wrapper = mount(BillingCloseStep, {
      props: {
        overview: overview(),
        period: buildPeriod({ status: 'issued' }),
        canClose: true,
        onClosePeriod,
      },
      global: {
        stubs: {
          UiSection: passthrough,
          UiButton: buttonStub,
          UiAlert: alertStub,
          UiStatusBadge: passthrough,
          UiConfirmModal: confirmStub,
        },
      },
    })

    await wrapper.findAll('button').at(0)!.trigger('click')
    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)

    await wrapper.get('[data-test="confirm"]').trigger('click')
    await flushPromises()

    expect(onClosePeriod).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Chốt kỳ thất bại')
  })
})
