import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BillingCloseStep from '../../../app/components/billing/BillingCloseStep.vue'
import { buildPeriod } from '../../__fixtures__/billing/period'
import type { BillingWorkspaceOverview } from '../../../app/types/billing'

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

describe('billing action confirmation safety', () => {
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
