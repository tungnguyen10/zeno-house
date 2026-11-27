import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { usePortalInvoices } from '~/composables/tenant-portal/usePortalInvoices'

const key = ref('tenant-a')
const data = ref({ data: { invoices: [{ id: 'a-first' }], invoiceMeta: { page: 1, limit: 1, total: 2, totalPages: 2 } } })
const fetchMock = vi.fn()
const refresh = vi.fn(async () => {})
vi.stubGlobal('usePortalSessionKey', () => key)
vi.stubGlobal('useFetch', () => ({ data, status: ref('success'), error: ref(null), refresh }))
vi.stubGlobal('$fetch', fetchMock)
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.forEach(scope => scope.stop()); scopes.length = 0; vi.clearAllMocks() })

function setup() {
  key.value = 'tenant-a'
  data.value = { data: { invoices: [{ id: 'a-first' }], invoiceMeta: { page: 1, limit: 1, total: 2, totalPages: 2 } } }
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => usePortalInvoices())!
}

describe('invoice append requests stay with their account and list generation', () => {
  it('discards a delayed page from A while B loads its own page', async () => {
    let resolveA!: (value: unknown) => void
    let resolveB!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(new Promise(done => { resolveA = done }))
      .mockReturnValueOnce(new Promise(done => { resolveB = done }))
    const list = setup()
    const requestA = list.loadMore()
    key.value = 'tenant-b'
    data.value = { data: { invoices: [{ id: 'b-first' }], invoiceMeta: { page: 1, limit: 1, total: 2, totalPages: 2 } } }
    const requestB = list.loadMore()
    resolveA({ data: [{ id: 'a-private' }], meta: { page: 2 } })
    await requestA
    expect(list.invoices.value.map(item => item.id)).toEqual(['b-first'])
    expect(list.loadingMore.value).toBe(true)
    resolveB({ data: [{ id: 'b-second' }], meta: { page: 2 } })
    await requestB
    expect(list.invoices.value.map(item => item.id)).toEqual(['b-first', 'b-second'])
    expect(list.hasMore.value).toBe(false)
  })

  it('does not append an obsolete page or error after a list refresh', async () => {
    let rejectPage!: (reason: unknown) => void
    fetchMock.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectPage = reject }))
    const list = setup()
    const pending = list.loadMore()
    await list.refresh()
    rejectPage(new Error('Old request failed'))
    await pending
    expect(list.invoices.value.map(item => item.id)).toEqual(['a-first'])
    expect(list.loadMoreError.value).toBeNull()
    expect(list.hasMore.value).toBe(true)
  })
})
