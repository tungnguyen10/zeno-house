import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { AiBuildingService } from '../../../server/services/ai/buildings'

const mocks = vi.hoisted(() => ({
  listScoped: vi.fn(),
  resolveScoped: vi.fn(),
  getScope: vi.fn(),
  can: vi.fn(),
}))

vi.mock('../../../server/repositories/ai/buildings', () => ({
  AiBuildingRepository: { listScoped: mocks.listScoped, resolveScoped: mocks.resolveScoped },
}))
vi.mock('../../../server/utils/scope', () => ({ getAssignedBuildingIds: mocks.getScope }))
vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))

const event = {} as never
const actor = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser
const building = {
  id: 'building-1', slug: 'zeno-central', name: 'Zeno Central', address: '1 Main',
  status: 'active' as const, updatedAt: '2026-07-14T00:00:00.000Z',
}

describe('AiBuildingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.getScope.mockResolvedValue(['building-1'])
  })

  it('passes assigned scope into list and resolution queries', async () => {
    mocks.listScoped.mockResolvedValue([building])
    mocks.resolveScoped.mockResolvedValue([building])

    await expect(AiBuildingService.list(event, actor)).resolves.toEqual([building])
    await expect(AiBuildingService.resolve(event, actor, 'Zeno Central')).resolves.toEqual({
      status: 'resolved', building,
    })
    expect(mocks.listScoped).toHaveBeenCalledWith(event, ['building-1'])
    expect(mocks.resolveScoped).toHaveBeenCalledWith(event, 'Zeno Central', ['building-1'])
  })

  it('returns structured ambiguity without selecting a candidate', async () => {
    const other = { ...building, id: 'building-2', slug: 'zeno-central-2' }
    mocks.resolveScoped.mockResolvedValue([building, other])
    await expect(AiBuildingService.resolve(event, actor, 'Zeno Central')).resolves.toEqual({
      status: 'ambiguous', candidates: [building, other],
    })
  })

  it('uses the same not-found result for unknown or filtered-out references', async () => {
    mocks.resolveScoped.mockResolvedValue([])
    await expect(AiBuildingService.resolve(event, actor, 'Secret Building')).resolves.toEqual({ status: 'not_found' })
  })

  it('rejects users without building read capability before querying', async () => {
    mocks.can.mockReturnValue(false)
    await expect(AiBuildingService.resolve(event, actor, 'Zeno Central')).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.resolveScoped).not.toHaveBeenCalled()
  })
})
