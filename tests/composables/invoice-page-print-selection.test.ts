import { nextTick, ref } from 'vue'
import type { InvoiceListItem } from '../../app/utils/validators/invoices'

function row(id: string): InvoiceListItem {
  return {
    id,
    invoice_code: id,
    billing_period_id: 'period-1',
    period_year: 2026,
    period_month: 6,
    building_id: 'building-1',
    building_name: 'Building',
    room_id: 'room-1',
    room_number: '101',
    contract_id: 'contract-1',
    contract_code: 'HD-1',
    tenant_id: 'tenant-1',
    tenant_name: 'Tenant',
    total_amount: 1,
    paid_amount: 0,
    balance_amount: 1,
    due_date: null,
    status: 'issued',
    issued_at: null,
  }
}

describe('useInvoicePagePrintSelection', () => {
  it('selects active invoices and clears selection when current-page results change', async () => {
    const rows = ref([row('invoice-1'), row('invoice-2')])
    const { useInvoicePagePrintSelection } = await import('../../app/composables/invoices/useInvoicePagePrintSelection')
    const selection = useInvoicePagePrintSelection(rows)

    selection.toggle(rows.value[0]!)
    expect([...selection.selectedIds.value]).toEqual(['invoice-1'])

    rows.value = [row('invoice-3')]
    await nextTick()
    expect(selection.selectedIds.value.size).toBe(0)
  })

  it('never selects a void invoice', async () => {
    const voided = { ...row('invoice-void'), status: 'void' as const }
    const rows = ref([voided])
    const { useInvoicePagePrintSelection } = await import('../../app/composables/invoices/useInvoicePagePrintSelection')
    const selection = useInvoicePagePrintSelection(rows)

    selection.toggle(voided)
    expect(selection.selectedIds.value.size).toBe(0)
  })

  it('clears selection when refreshed results replace the page with the same ids', async () => {
    const rows = ref([row('invoice-1')])
    const { useInvoicePagePrintSelection } = await import('../../app/composables/invoices/useInvoicePagePrintSelection')
    const selection = useInvoicePagePrintSelection(rows)

    selection.toggle(rows.value[0]!)
    rows.value = [{ ...row('invoice-1'), status: 'paid' }]
    await nextTick()

    expect(selection.selectedIds.value.size).toBe(0)
  })
})
