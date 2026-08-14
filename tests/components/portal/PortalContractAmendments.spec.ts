import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import PortalContractAmendments from '../../../app/components/portal/PortalContractAmendments.vue'
import type { TenantContractAmendmentSummary } from '../../../app/types/contract-amendments'

const PortalCard = defineComponent({ setup(_, { slots }) { return () => h('div', { class: 'portal-card' }, slots.default?.()) } })

function amendment(status: TenantContractAmendmentSummary['status'], content = 'Giá thuê mới áp dụng từ tháng 9.'): TenantContractAmendmentSummary {
  return {
    id: `amendment-${status}`, sequenceNo: status === 'scheduled' ? 2 : 1,
    title: status === 'scheduled' ? 'Điều chỉnh tiền thuê' : 'Điều chỉnh ngày thanh toán',
    publicContent: content, effectiveDate: '2026-09-01', status,
    changes: status === 'scheduled' ? { monthlyRent: 4_000_000 } : { paymentDueDay: null },
    beforeTerms: { monthlyRent: 3_000_000, deposit: 3_000_000, paymentDueDay: 5, occupantCount: 2, discountAmount: 0, surchargeAmount: 0 },
    afterTerms: { monthlyRent: status === 'scheduled' ? 4_000_000 : 3_000_000, deposit: 3_000_000, paymentDueDay: status === 'applied' ? null : 5, occupantCount: 2, discountAmount: 0, surchargeAmount: 0 },
  }
}

describe('PortalContractAmendments', () => {
  it('renders scheduled and applied amendments with tenant-safe content and diffs', () => {
    const wrapper = mount(PortalContractAmendments, {
      props: { amendments: [amendment('scheduled'), amendment('applied')] },
      global: { stubs: { PortalCard } },
    })

    expect(wrapper.text()).toContain('Phụ lục hợp đồng')
    expect(wrapper.text()).toContain('Sắp hiệu lực')
    expect(wrapper.text()).toContain('Đang áp dụng')
    expect(wrapper.text()).toContain('3.000.000 ₫')
    expect(wrapper.text()).toContain('4.000.000 ₫')
    expect(wrapper.text()).toContain('Kế thừa tòa nhà')
  })

  it('does not render whitespace-only public content', () => {
    const wrapper = mount(PortalContractAmendments, {
      props: { amendments: [amendment('scheduled', '   ')] },
      global: { stubs: { PortalCard } },
    })
    expect(wrapper.find('p.whitespace-pre-line').exists()).toBe(false)
  })
})
