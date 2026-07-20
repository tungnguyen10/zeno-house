import type { ComputedRef, Ref } from 'vue'
import type { InvoiceListItem } from '~/utils/validators/invoices'

export function useInvoicePagePrintSelection(rows: Ref<InvoiceListItem[]> | ComputedRef<InvoiceListItem[]>) {
  const selectedIds = ref<Set<string>>(new Set())

  function clearSelection() {
    selectedIds.value = new Set()
  }

  function toggle(invoice: InvoiceListItem) {
    if (invoice.status === 'void') return
    const next = new Set(selectedIds.value)
    if (next.has(invoice.id)) next.delete(invoice.id)
    else next.add(invoice.id)
    selectedIds.value = next
  }

  const selectedInvoices = computed(() =>
    rows.value.filter(invoice => selectedIds.value.has(invoice.id) && invoice.status !== 'void'),
  )

  watch(
    () => rows.value,
    clearSelection,
  )

  return { selectedIds, selectedInvoices, toggle, clearSelection }
}
