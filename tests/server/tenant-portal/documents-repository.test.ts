import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../../server/utils/db', () => ({ db: mocks.db }))

describe('TenantDocumentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue({
      list: mocks.list,
      upload: mocks.upload,
      remove: mocks.remove,
      createSignedUrl: mocks.createSignedUrl,
    })
    mocks.db.mockReturnValue({ storage: { from: mocks.from } })
    mocks.list.mockResolvedValue({
      data: [{
        id: 'object-1',
        name: 'document.pdf',
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z',
        metadata: {
          mimetype: 'application/pdf',
          size: 2048,
          originalName: 'Hợp đồng.pdf',
        },
      }],
      error: null,
    })
    mocks.upload.mockResolvedValue({
      data: { id: 'object-2', path: 'tenant-1/new-document.pdf' },
      error: null,
    })
    mocks.remove.mockResolvedValue({ data: [], error: null })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.test/document' },
      error: null,
    })
  })

  it('lists only the resolved tenant prefix and maps file metadata', async () => {
    const { TenantDocumentRepository } = await import(
      '../../../server/repositories/tenant-portal/documents'
    )

    const result = await TenantDocumentRepository.list({} as never, 'tenant-1')

    expect(mocks.from).toHaveBeenCalledWith('tenant-documents')
    expect(mocks.list).toHaveBeenCalledWith('tenant-1', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    expect(result).toEqual([{
      id: 'object-1',
      path: 'tenant-1/document.pdf',
      name: 'Hợp đồng.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      createdAt: '2026-07-16T12:00:00.000Z',
    }])
  })

  it('uploads without upsert and preserves the original filename as metadata', async () => {
    const { TenantDocumentRepository } = await import(
      '../../../server/repositories/tenant-portal/documents'
    )
    const data = Buffer.from('document')

    const result = await TenantDocumentRepository.upload(
      {} as never,
      'tenant-1/new-document.pdf',
      { name: 'Hợp đồng.pdf', mimeType: 'application/pdf', data },
    )

    expect(mocks.upload).toHaveBeenCalledWith('tenant-1/new-document.pdf', data, {
      contentType: 'application/pdf',
      metadata: { originalName: 'Hợp đồng.pdf' },
      upsert: false,
    })
    expect(result).toEqual({ id: 'object-2', path: 'tenant-1/new-document.pdf' })
  })

  it('creates five-minute signed URLs and removes exact paths', async () => {
    const { TenantDocumentRepository } = await import(
      '../../../server/repositories/tenant-portal/documents'
    )

    await expect(TenantDocumentRepository.createSignedUrl(
      {} as never,
      'tenant-1/document.pdf',
    )).resolves.toBe('https://signed.test/document')
    await TenantDocumentRepository.remove({} as never, 'tenant-1/document.pdf')

    expect(mocks.createSignedUrl).toHaveBeenCalledWith('tenant-1/document.pdf', 300)
    expect(mocks.remove).toHaveBeenCalledWith(['tenant-1/document.pdf'])
  })
})
