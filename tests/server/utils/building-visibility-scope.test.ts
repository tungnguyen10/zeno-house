import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
  findByUserAndBuilding: vi.fn(),
}))
const visibilityRepoMocks = vi.hoisted(() => ({
  findHiddenIds: vi.fn(),
  findVisibleIds: vi.fn(),
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))
vi.mock('../../../server/repositories/buildings/visibility', () => ({
  BuildingVisibilityRepository: visibilityRepoMocks,
}))
vi.mock('../../../server/repositories/tenant-portal/links', () => ({
  getTenantIdForAuthUser: vi.fn(),
}))

function user(role: 'admin' | 'owner' | 'manager'): AuthUser {
  return { id: `${role}-user`, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('getVisibleBuildingIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    visibilityRepoMocks.findHiddenIds.mockResolvedValue([])
    visibilityRepoMocks.findVisibleIds.mockResolvedValue([])
  })

  it('keeps admin unscoped while nothing is hidden', async () => {
    const { getVisibleBuildingIds } = await import('../../../server/utils/scope')

    await expect(getVisibleBuildingIds(event(), user('admin'))).resolves.toBeNull()
    expect(visibilityRepoMocks.findVisibleIds).not.toHaveBeenCalled()
  })

  it('gives admin an explicit visible list once something is hidden', async () => {
    visibilityRepoMocks.findHiddenIds.mockResolvedValue(['building-hidden'])
    visibilityRepoMocks.findVisibleIds.mockResolvedValue(['building-a', 'building-b'])
    const { getVisibleBuildingIds } = await import('../../../server/utils/scope')

    await expect(getVisibleBuildingIds(event(), user('admin'))).resolves.toEqual([
      'building-a',
      'building-b',
    ])
  })

  it('subtracts hidden buildings from a manager assignment scope', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a', 'building-b'])
    visibilityRepoMocks.findHiddenIds.mockResolvedValue(['building-b'])
    const { getVisibleBuildingIds } = await import('../../../server/utils/scope')

    await expect(getVisibleBuildingIds(event(), user('manager'))).resolves.toEqual(['building-a'])
  })

  it('empties the scope when every assigned building is hidden', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    visibilityRepoMocks.findHiddenIds.mockResolvedValue(['building-a'])
    const { getVisibleBuildingIds } = await import('../../../server/utils/scope')

    await expect(getVisibleBuildingIds(event(), user('owner'))).resolves.toEqual([])
  })

  it('resolves once per request', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    const requestEvent = event()
    const manager = user('manager')
    const { getVisibleBuildingIds } = await import('../../../server/utils/scope')

    await getVisibleBuildingIds(requestEvent, manager)
    await getVisibleBuildingIds(requestEvent, manager)

    expect(visibilityRepoMocks.findHiddenIds).toHaveBeenCalledTimes(1)
    expect(assignmentRepoMocks.findBuildingIdsByUser).toHaveBeenCalledTimes(1)
  })

  it('leaves the permission scope blind to visibility', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a', 'building-b'])
    visibilityRepoMocks.findHiddenIds.mockResolvedValue(['building-b'])
    const { getAssignedBuildingIds, assertBuildingScope } = await import('../../../server/utils/scope')

    await expect(getAssignedBuildingIds(event(), user('manager'))).resolves.toEqual([
      'building-a',
      'building-b',
    ])
    // A hidden building still resolves for a direct read.
    await expect(assertBuildingScope(event(), user('manager'), 'building-b', 'read')).resolves.toBeUndefined()
  })
})
