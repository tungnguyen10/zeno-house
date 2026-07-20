import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import InvoicePrintCard from '../../../app/components/invoices/InvoicePrintCard.vue'
import type { InvoicePrintItem } from '../../../app/types/billing'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

function printItem(): InvoicePrintItem {
  return {
    invoice: buildInvoice({
      id: '00000000-0000-4000-8000-000000000001',
      invoiceCode: 'INV-2606-014',
      tenantName: 'Nguyễn Văn An',
      roomNumber: '101',
      status: 'partial',
      totalAmount: 3_500_000,
      paidAmount: 1_000_000,
      balanceAmount: 2_500_000,
      issuedAt: '2026-06-01T00:00:00.000Z',
      dueDate: '2026-06-10',
    }),
    period: buildPeriod({ periodYear: 2026, periodMonth: 6 }),
    building: { id: 'building-1', name: 'Zeno House A', address: '12 Nguyễn Trãi' },
    charges: [
      {
        id: 'charge-rent', invoiceId: '00000000-0000-4000-8000-000000000001',
        chargeType: 'rent', label: 'Tiền thuê', sourceType: null, sourceId: null,
        quantity: 1, unitPrice: 3_000_000, amount: 3_000_000, metadata: {}, sortOrder: 1,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'charge-electricity', invoiceId: '00000000-0000-4000-8000-000000000001',
        chargeType: 'electricity', label: 'Điện', sourceType: 'meter_reading', sourceId: 'reading-1',
        quantity: 100, unitPrice: 5_000, amount: 500_000,
        metadata: { previous_reading_value: 1200, current_reading_value: 1300 }, sortOrder: 2,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ],
  }
}

describe('InvoicePrintCard', () => {
  it('renders invoice snapshot identity, meter metadata, and debt summary', () => {
    const wrapper = mount(InvoicePrintCard, {
      props: { item: printItem() },
      global: {
        stubs: {
          UiStatusBadge: defineComponent({
            props: ['status'],
            template: '<span data-test="status">{{ status }}</span>',
          }),
        },
      },
    })

    expect(wrapper.text()).toContain('Hóa đơn tháng 06/2026')
    expect(wrapper.text()).toContain('INV-2606-014')
    expect(wrapper.text()).toContain('Zeno House A')
    expect(wrapper.text()).toContain('12 Nguyễn Trãi')
    expect(wrapper.text()).toContain('Phòng 101')
    expect(wrapper.text()).toContain('Nguyễn Văn An')
    expect(wrapper.text()).toContain('1.200 → 1.300')
    expect(wrapper.text()).toContain('100 kWh')
    expect(wrapper.text()).toContain('3.500.000')
    expect(wrapper.text()).toContain('1.000.000')
    expect(wrapper.text()).toContain('2.500.000')
    expect(wrapper.get('[data-test="status"]').text()).toBe('partial')
  })
})
