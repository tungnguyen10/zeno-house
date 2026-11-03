import { afterEach, vi } from 'vitest'

const originalWindowPrint = Object.getOwnPropertyDescriptor(window, 'print')

describe('useInvoicePrinting', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (originalWindowPrint) Object.defineProperty(window, 'print', originalWindowPrint)
    else Reflect.deleteProperty(window, 'print')
  })

  it('opens the shared route for ordered unique invoice ids', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.stubGlobal('useToast', () => ({ error: vi.fn() }))
    const { useInvoicePrinting } = await import('../../app/composables/invoices/useInvoicePrinting')

    const result = useInvoicePrinting().openPrint(['invoice-2', 'invoice-1', 'invoice-2'])

    expect(result).toBe(true)
    expect(window.localStorage).toBeDefined()
    expect(open).toHaveBeenCalledWith(
      '/dashboard/invoices/print?ids=invoice-2%2Cinvoice-1', '_blank', 'noopener',
    )
  })

  it('rejects an empty or over-limit batch before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const error = vi.fn()
    vi.stubGlobal('useToast', () => ({ error }))
    const { useInvoicePrinting } = await import('../../app/composables/invoices/useInvoicePrinting')
    const printing = useInvoicePrinting()

    expect(printing.openPrint([])).toBe(false)
    expect(printing.openPrint(Array.from({ length: 101 }, (_, index) => `invoice-${index}`))).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('Chọn từ 1 đến 100 hoá đơn để in')
  })

  it('opens the native print dialog even when audit recording fails', async () => {
    const print = vi.fn()
    Object.defineProperty(window, 'print', { configurable: true, value: print })
    const apiFetch = vi.fn().mockRejectedValue(new Error('audit unavailable'))
    vi.stubGlobal('apiFetch', apiFetch)
    vi.stubGlobal('useToast', () => ({ error: vi.fn() }))
    const { useInvoicePrinting } = await import('../../app/composables/invoices/useInvoicePrinting')

    useInvoicePrinting().printNow(['invoice-1'])

    expect(apiFetch).toHaveBeenCalledWith('/api/billing/invoices/printed', {
      method: 'POST',
      body: { invoice_ids: ['invoice-1'] },
    })
    expect(print).toHaveBeenCalledOnce()
  })
})
