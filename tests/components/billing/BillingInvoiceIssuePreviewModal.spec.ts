import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BillingInvoiceIssuePreviewModal from '../../../app/components/billing/BillingInvoiceIssuePreviewModal.vue'
import type { BillingInvoiceIssuePreview } from '../../../app/types/billing'
import { buildPeriod } from '../../__fixtures__/billing/period'

const passthrough = defineComponent({ template: '<div><slot /><slot name="footer" /></div>' })

function preview(): BillingInvoiceIssuePreview {
  return {
    periodId: 'period-1',
    calculationDate: '2026-08-06',
    dueDateOverride: null,
    operationId: '00000000-0000-7000-8000-000000000099',
    snapshotHash: 'a'.repeat(64),
    issuableCount: 1,
    blockedCount: 1,
    alreadyIssuedCount: 0,
    totalAmount: 3_200_000,
    exclusions: [{
      contractId: 'contract-2', roomNumber: '102', tenantName: 'B', reason: 'blocked', messages: ['Thiếu chỉ số điện'],
    }],
    items: [{
      mode: 'draft', key: 'contract-1', invoiceCode: null, status: 'draft', roomNumber: '101', tenantName: 'A',
      issuedAt: '2026-08-05T00:00:00.000Z', dueDate: '2026-08-09', gracePeriodDays: 2,
      overdueDate: '2026-08-11', totalAmount: 3_200_000,
      paidAmount: 0, balanceAmount: 3_200_000, charges: [], invoiceProfile: null,
      period: buildPeriod(), building: { id: 'building-1', name: 'Zeno', address: '1 Nguyễn Huệ' }, warnings: [],
    }],
  }
}

describe('BillingInvoiceIssuePreviewModal', () => {
  it('shows batch summary and exclusions without exposing a print action', () => {
    const wrapper = mount(BillingInvoiceIssuePreviewModal, {
      props: { open: true, preview: preview(), dueDate: '2026-08-09', useOverride: false, loading: false, submitting: false, error: null },
      global: {
        stubs: {
          UiModal: passthrough,
          UiDatePicker: defineComponent({ props: ['modelValue', 'label'], template: '<label>{{ label }}<input :value="modelValue"></label>' }),
          UiAlert: passthrough,
          UiButton: defineComponent({ template: '<button><slot /></button>' }),
          UiEmptyState: true,
          UiSkeleton: true,
          InvoicePrintCard: defineComponent({ props: ['item'], template: '<article>BẢN NHÁP · {{ item.roomNumber }}</article>' }),
        },
      },
    })

    expect(wrapper.text()).toContain('1 hóa đơn · 3.200.000')
    expect(wrapper.text()).toContain('Áp một hạn chung')
    expect(wrapper.text()).toContain('Hạn được tự tính riêng')
    expect(wrapper.text()).not.toContain('Hạn thanh toán chung')
    expect(wrapper.text()).toContain('Thiếu chỉ số điện')
    expect(wrapper.text()).toContain('BẢN NHÁP · 101')
    expect(wrapper.text()).not.toContain('In')
  })

  it('shows the shared date picker only in override mode', () => {
    const wrapper = mount(BillingInvoiceIssuePreviewModal, {
      props: {
        open: true, preview: preview(), dueDate: '2026-08-09', useOverride: true,
        loading: false, submitting: false, error: null,
      },
      global: {
        stubs: {
          UiModal: passthrough,
          UiCheckbox: true,
          UiDatePicker: defineComponent({ props: ['label'], template: '<label>{{ label }}</label>' }),
          UiButton: defineComponent({ template: '<button><slot /></button>' }),
          InvoicePrintCard: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Hạn thanh toán chung')
    expect(wrapper.text()).not.toContain('Hạn được tự tính riêng')
  })

  it('keeps confirm disabled while stale and offers a refresh', () => {
    const wrapper = mount(BillingInvoiceIssuePreviewModal, {
      props: {
        open: true, preview: preview(), dueDate: '2026-08-09', useOverride: false, loading: false, submitting: false,
        error: 'Dữ liệu đã đổi', stale: true,
      },
      global: {
        stubs: {
          UiModal: passthrough, UiDatePicker: true, UiAlert: passthrough,
          UiButton: defineComponent({ props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' }),
          InvoicePrintCard: true,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.find(button => button.text().includes('Tải lại'))).toBeTruthy()
    expect(buttons.find(button => button.text().includes('Phát hành'))?.attributes('disabled')).toBeDefined()
  })
})
