import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { usePortalContractDocuments } from '~/composables/tenant-portal/usePortalContractDocuments'

const sessionKey = ref('portal-a-contract-documents')
const documents = [{ id: 'document-1', type: 'contract', status: 'issued', versionNo: 1 }]
const data = ref({ data: documents })
const fetchMock = vi.fn()
const replace = vi.fn()
const close = vi.fn()
const openMock = vi.spyOn(window, 'open')
let scope = effectScope()
vi.stubGlobal('usePortalSessionKey', () => sessionKey)
vi.stubGlobal('useFetch', () => ({ data, status: ref('success'), error: ref(null), refresh: vi.fn() }))
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => {
  scope = effectScope()
  sessionKey.value = 'portal-a-contract-documents'
  vi.clearAllMocks()
  openMock.mockReturnValue({ location: { replace }, close, opener: null } as unknown as Window)
})
afterEach(() => scope.stop())

describe('official contract document downloads', () => {
  it('requests the download URL only on explicit open and leaves list state without the URL', async () => {
    const list = scope.run(() => usePortalContractDocuments())!
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValue({ data: { url: 'https://private.example/document?token=short-lived', expiresIn: 60 } })
    await list.download('document-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/tenant/contract-documents/document-1/download')
    expect(replace).toHaveBeenCalledWith('https://private.example/document?token=short-lived')
    expect(list.documents.value).toEqual(documents)
    expect(JSON.stringify(list.documents.value)).not.toContain('token=')
    expect(list.downloading.value).toBeNull()
  })

  it('closes the blank tab instead of opening the prior account signed document', async () => {
    let resolve!: (value: unknown) => void
    fetchMock.mockReturnValue(new Promise(done => { resolve = done }))
    const list = scope.run(() => usePortalContractDocuments())!
    const pending = list.download('document-1')
    sessionKey.value = 'portal-b-contract-documents'
    resolve({ data: { url: 'https://private.example/a-document', expiresIn: 60 } })
    await pending
    expect(close).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
    expect(list.downloadError.value).toBeNull()
  })

  it('shows a retryable error and closes the unused tab when the endpoint fails', async () => {
    fetchMock.mockRejectedValue({ data: { error: { message: 'Không tải được tài liệu.' } } })
    const list = scope.run(() => usePortalContractDocuments())!
    await list.download('document-1')
    expect(close).toHaveBeenCalledOnce()
    expect(list.downloadError.value).toBe('Không tải được tài liệu.')
    expect(list.downloading.value).toBeNull()
  })
})
