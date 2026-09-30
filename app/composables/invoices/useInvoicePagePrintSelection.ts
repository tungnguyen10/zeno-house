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

  // Void invoices can never be printed, so they are excluded from "select all".
  const selectableInvoices = computed(() => rows.value.filter(invoice => invoice.status !== 'void'))

  const allSelected = computed(() =>
    selectableInvoices.value.length > 0 && selectedInvoices.value.length === selectableInvoices.value.length,
  )

  const someSelected = computed(() => selectedInvoices.value.length > 0 && !allSelected.value)

  function toggleAll() {
    selectedIds.value = allSelected.value
      ? new Set()
      : new Set(selectableInvoices.value.map(invoice => invoice.id))
  }

  watch(
    () => rows.value,
    clearSelection,
  )

  return {
    selectedIds,
    selectedInvoices,
    selectableInvoices,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clearSelection,
  }
}
