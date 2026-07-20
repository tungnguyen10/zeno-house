import { invoicePrintPath } from '~/utils/routes/operational'

export function useInvoicePrinting() {
  const toast = useToast()

  function openPrint(invoiceIds: string[]): boolean {
    const ids = [...new Set(invoiceIds)]
    if (ids.length < 1 || ids.length > 100) {
      toast.error('Chọn từ 1 đến 100 hoá đơn để in')
      return false
    }
    window.open(invoicePrintPath(ids), '_blank', 'noopener')
    return true
  }

  function printNow(invoiceIds: string[]) {
    // This fire-and-forget event records that the operator opened the print
    // dialog. Browser APIs cannot tell whether the dialog was later confirmed.
    apiFetch('/api/billing/invoices/printed', {
      method: 'POST',
      body: { invoice_ids: [...new Set(invoiceIds)] },
    }).catch(() => {})
    window.print()
  }

  return { openPrint, printNow }
}
