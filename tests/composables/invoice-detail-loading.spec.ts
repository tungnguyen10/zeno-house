import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useInvoiceDetail } from '../../app/composables/invoices/useInvoiceDetail'

beforeEach(() => vi.stubGlobal('ref', ref))
afterEach(() => vi.unstubAllGlobals())

describe('useInvoiceDetail loading lifecycle', () => {
  it('ignores a response from a closed drawer', async () => {
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal('apiFetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve })))
    const detail = useInvoiceDetail()

    const request = detail.load('INV-1')
    expect(detail.isLoading.value).toBe(true)
    detail.clear()
    resolveFetch({ data: { invoice: { id: 'old' } } })
    await request

    expect(detail.detail.value).toBeNull()
    expect(detail.isLoading.value).toBe(false)
  })

  it('keeps the most recent invoice when requests resolve out of order', async () => {
    const resolvers: Array<(value: unknown) => void> = []
    vi.stubGlobal('apiFetch', vi.fn(() => new Promise(resolve => { resolvers.push(resolve) })))
    const detail = useInvoiceDetail()

    const first = detail.load('INV-1')
    const second = detail.load('INV-2')
    resolvers[1]!({ data: { invoice: { id: 'new' } } })
    await second
    resolvers[0]!({ data: { invoice: { id: 'old' } } })
    await first

    expect(detail.detail.value?.invoice.id).toBe('new')
    expect(detail.isLoading.value).toBe(false)
  })
})
