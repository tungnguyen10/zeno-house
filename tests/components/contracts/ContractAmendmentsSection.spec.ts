import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ContractAmendmentsSection from '../../../app/components/contracts/ContractAmendmentsSection.vue'
import type { ContractAmendment } from '../../../app/types/contract-amendments'
import type { ContractWithDetails } from '../../../app/types/contracts'

const passthrough = defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } })
const button = defineComponent({
  props: ['disabled', 'loading'], emits: ['click'],
  setup(props, { slots, emit }) { return () => h('button', { disabled: props.disabled || props.loading, onClick: () => emit('click') }, slots.default?.()) },
})

const stubs = {
  UiSection: passthrough,
  UiSurfacePanel: passthrough,
  UiButton: button,
  UiStatusBadge: defineComponent({
    props: ['status'], setup(props) { return () => h('span', { 'data-status': props.status }, props.status) },
  }),
  UiSkeleton: passthrough,
  UiAlert: passthrough,
  UiEmptyState: defineComponent({ props: ['title'], template: '<p>{{ title }}</p>' }),
  UiConfirmModal: defineComponent({ template: '<div />' }),
  UiModal: defineComponent({ template: '<div />' }),
  UiTextarea: defineComponent({ template: '<textarea />' }),
  ContractAmendmentForm: defineComponent({ template: '<form />' }),
}

function contract(): ContractWithDetails {
  return {
    id: 'contract-1', contractCode: 'HD-001', roomId: 'room-1', tenantId: 'tenant-1', buildingId: 'building-1',
    startDate: '2026-01-01', endDate: '2027-01-01', monthlyRent: 3_000_000, deposit: 3_000_000,
    paymentDueDay: 5, occupantCount: 2, discountAmount: 0, surchargeAmount: 0, previousContractId: null,
    originalEndDate: null, renewalCount: 0, status: 'active', notes: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    room: { id: 'room-1', code: 'a-101', roomNumber: 'A101', floor: 1, buildingId: 'building-1', buildingName: 'Tòa A' },
    tenant: { id: 'tenant-1', code: 't-1', fullName: 'An', phone: '0901' },
  }
}

function amendment(status: ContractAmendment['status'], sequenceNo: number): ContractAmendment {
  return {
    id: `amendment-${sequenceNo}`, contractId: 'contract-1', sequenceNo, title: `Phụ lục ${sequenceNo}`,
    publicContent: 'Nội dung công khai', effectiveDate: '2026-09-01', status,
    changes: { monthlyRent: 4_000_000 },
    beforeTerms: status === 'draft' ? null : { monthlyRent: 3_000_000, deposit: 3_000_000, paymentDueDay: 5, occupantCount: 2, discountAmount: 0, surchargeAmount: 0 },
    afterTerms: status === 'draft' ? null : { monthlyRent: 4_000_000, deposit: 3_000_000, paymentDueDay: 5, occupantCount: 2, discountAmount: 0, surchargeAmount: 0 },
    createdBy: 'user-1', publishedBy: status === 'draft' ? null : 'user-1', appliedBy: status === 'applied' ? 'user-1' : null,
    cancelledBy: status === 'cancelled' ? 'user-1' : null,
    cancellationReason: status === 'cancelled' ? 'Gia hạn hợp đồng' : null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-02T00:00:00Z',
    publishedAt: status === 'draft' ? null : '2026-08-02T00:00:00Z', appliedAt: status === 'applied' ? '2026-09-01T00:00:00Z' : null,
    cancelledAt: status === 'cancelled' ? '2026-08-03T00:00:00Z' : null,
  }
}

describe('ContractAmendmentsSection', () => {
  it('renders lifecycle states, immutable diffs, and only valid actions', () => {
    const wrapper = mount(ContractAmendmentsSection, {
      props: {
        contract: contract(),
        amendments: [amendment('draft', 4), amendment('scheduled', 3), amendment('applied', 2), amendment('cancelled', 1)],
        canManage: true,
        createAmendment: vi.fn(), updateAmendment: vi.fn(), removeAmendment: vi.fn(),
        publishAmendment: vi.fn(), cancelAmendment: vi.fn(),
      },
      global: { stubs },
    })

    expect(wrapper.findAll('[data-status]').map(node => node.attributes('data-status')))
      .toEqual(['draft', 'scheduled', 'applied', 'cancelled'])
    expect(wrapper.text()).toContain('3.000.000 ₫ → 4.000.000 ₫')
    expect(wrapper.text()).toContain('Lý do hủy: Gia hạn hợp đồng')
    expect(wrapper.text()).toContain('Ban hành')
    expect(wrapper.text()).toContain('Hủy phụ lục')
    expect(wrapper.text()).not.toContain('Hủy phụ lụcPhụ lục 2')
  })

  it('hides mutation controls for read-only users', () => {
    const wrapper = mount(ContractAmendmentsSection, {
      props: {
        contract: contract(), amendments: [amendment('scheduled', 1)], canManage: false,
        createAmendment: vi.fn(), updateAmendment: vi.fn(), removeAmendment: vi.fn(),
        publishAmendment: vi.fn(), cancelAmendment: vi.fn(),
      },
      global: { stubs },
    })
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
