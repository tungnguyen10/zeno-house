import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkContractDocumentReadiness, useContractDocuments } from '~/composables/contracts/useContractDocuments'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockResolvedValue({ data: [] })
})

describe('useContractDocuments', () => {
  it('lists documents for the contract', async () => {
    fetchMock.mockResolvedValueOnce({ data: [{ id: 'd-1' }] })
    const docs = useContractDocuments('c-1')
    await docs.refresh()
    expect(fetchMock).toHaveBeenCalledWith('/api/contracts/c-1/documents')
    expect(docs.documents.value).toEqual([{ id: 'd-1' }])
  })

  it('issues with a generated request_id and refreshes', async () => {
    fetchMock.mockResolvedValueOnce({ data: { id: 'd-9' } }).mockResolvedValueOnce({ data: [{ id: 'd-9' }] })
    const docs = useContractDocuments('c-1')
    const doc = await docs.issue({ type: 'contract', signed_date: '2026-11-12' })
    const [url, opts] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/contracts/c-1/documents')
    expect(opts.method).toBe('POST')
    expect(opts.body.type).toBe('contract')
    expect(opts.body.request_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(doc).toEqual({ id: 'd-9' })
  })

  it('voids with a reason', async () => {
    const docs = useContractDocuments('c-1')
    await docs.voidDocument('d-1', 'Sai thông tin bên thuê')
    expect(fetchMock).toHaveBeenCalledWith('/api/contract-documents/d-1/void', expect.objectContaining({
      method: 'POST', body: { reason: 'Sai thông tin bên thuê' },
    }))
  })

  it('readiness for a new contract posts the ids', async () => {
    fetchMock.mockResolvedValueOnce({ data: { ready: true, missing: [] } })
    const res = await checkContractDocumentReadiness({ room_id: 'r-1', tenant_id: 't-1', occupant_tenant_ids: ['o-1'] })
    expect(fetchMock).toHaveBeenCalledWith('/api/contract-documents/readiness', expect.objectContaining({
      method: 'POST', body: { room_id: 'r-1', tenant_id: 't-1', occupant_tenant_ids: ['o-1'] },
    }))
    expect(res.ready).toBe(true)
  })
})
