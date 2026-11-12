import { beforeEach, describe, expect, it, vi } from 'vitest'

const repo = { claimStale: vi.fn(), removeObject: vi.fn() }
vi.mock('../../../server/repositories/contract-documents', () => ({ ContractDocumentRepository: repo }))
vi.stubGlobal('defineEventHandler', (h: unknown) => h)

const reqHeaders: Record<string, string> = {}
vi.stubGlobal('getHeader', (_e: unknown, k: string) => reqHeaders[k])
vi.stubGlobal('useRuntimeConfig', () => ({ contractDocumentsCleanupSecret: 'secret-1' }))

beforeEach(() => {
  vi.clearAllMocks()
  reqHeaders['x-contract-documents-cleanup-secret'] = ''
  repo.claimStale.mockResolvedValue([{ id: 'd-1', storage_path: 'b/c/d.docx' }, { id: 'd-2', storage_path: null }])
  repo.removeObject.mockResolvedValue(undefined)
})

describe('contract-documents cleanup worker', () => {
  it('rejects a wrong secret with 403', async () => {
    reqHeaders['x-contract-documents-cleanup-secret'] = 'wrong'
    const { default: handler } = await import('../../../server/api/internal/contract-documents/cleanup.post')
    await expect(Promise.resolve(handler({} as never))).rejects.toMatchObject({ statusCode: 403 })
    expect(repo.claimStale).not.toHaveBeenCalled()
  })

  it('claims stale rows and removes their objects with the right secret', async () => {
    reqHeaders['x-contract-documents-cleanup-secret'] = 'secret-1'
    const { default: handler } = await import('../../../server/api/internal/contract-documents/cleanup.post')
    const res = await handler({} as never) as { data: { claimed: number; objectsRemoved: number } }
    expect(res.data).toEqual({ claimed: 2, objectsRemoved: 1 })
    expect(repo.removeObject).toHaveBeenCalledTimes(1)
  })
})
