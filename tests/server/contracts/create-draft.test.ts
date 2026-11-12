import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const repo = vi.hoisted(() => ({ find: vi.fn(), upsert: vi.fn(), remove: vi.fn() }))
vi.mock('../../../server/repositories/contract-create-drafts', () => ({ ContractCreateDraftRepository: repo }))

const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const ev = () => ({ context: {} }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (_u: AuthUser, cap: string) => cap === 'contracts.create')
})

describe('ContractCreateDraftService', () => {
  it('always keys by the caller', async () => {
    repo.upsert.mockResolvedValue({ payload: {}, updated_at: '2026-11-11T00:00:00Z' })
    const { ContractCreateDraftService } = await import('../../../server/services/contracts/create-draft')
    await ContractCreateDraftService.save(ev(), owner, { room_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e61' } as never)
    expect(repo.upsert).toHaveBeenCalledWith(expect.anything(), 'o-1', expect.anything())
  })

  it('expires drafts older than 30 days', async () => {
    repo.find.mockResolvedValue({ payload: { room_id: 'x' }, updated_at: '2026-01-01T00:00:00Z' })
    vi.setSystemTime(new Date('2026-11-11T00:00:00Z'))
    const { ContractCreateDraftService } = await import('../../../server/services/contracts/create-draft')
    expect(await ContractCreateDraftService.get(ev(), owner)).toBeNull()
    expect(repo.remove).toHaveBeenCalledWith(expect.anything(), 'o-1')
    vi.useRealTimers()
  })
})
