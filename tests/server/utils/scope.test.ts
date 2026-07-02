import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
  findByUserAndBuilding: vi.fn(),
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

function user(role: 'admin' | 'owner' | 'manager', id = `${role}-user`): AuthUser {
  return {
    id,
    app_metadata: { role },
  } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('building scope helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for admin scope and does not query assignments', async () => {
    const { getAssignedBuildingIds } = await import('../../../server/utils/scope')

    await expect(getAssignedBuildingIds(event(), user('admin'))).resolves.toBeNull()
    expect(assignmentRepoMocks.findBuildingIdsByUser).not.toHaveBeenCalled()
  })

  it('returns manager building ids and caches the result per request', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a', 'building-b'])
    const requestEvent = event()
    const manager = user('manager')
    const { getAssignedBuildingIds } = await import('../../../server/utils/scope')

    await expect(getAssignedBuildingIds(requestEvent, manager)).resolves.toEqual(['building-a', 'building-b'])
    await expect(getAssignedBuildingIds(requestEvent, manager)).resolves.toEqual(['building-a', 'building-b'])
    expect(assignmentRepoMocks.findBuildingIdsByUser).toHaveBeenCalledTimes(1)
    expect(assignmentRepoMocks.findBuildingIdsByUser).toHaveBeenCalledWith(requestEvent, manager.id)
  })

  it('uses 404 for read scope violations and 403 for write scope violations', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    const { assertBuildingScope } = await import('../../../server/utils/scope')

    await expect(assertBuildingScope(event(), user('manager'), 'building-b', 'read'))
      .rejects.toMatchObject({ statusCode: 404 })
    await expect(assertBuildingScope(event(), user('manager'), 'building-b', 'write'))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('grants destructive delete only to admins or assignments with the flag', async () => {
    const manager = user('manager')
    const { canDeleteMasterData } = await import('../../../server/utils/scope')

    await expect(canDeleteMasterData(event(), user('admin'), 'building-a')).resolves.toBe(true)

    assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue({ can_delete_master_data: false })
    await expect(canDeleteMasterData(event(), manager, 'building-a')).resolves.toBe(false)

    assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue({ can_delete_master_data: true })
    await expect(canDeleteMasterData(event(), manager, 'building-a')).resolves.toBe(true)
  })

  it('resolves owner scope from assignments like manager', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    const { getAssignedBuildingIds } = await import('../../../server/utils/scope')

    await expect(getAssignedBuildingIds(event(), user('owner'))).resolves.toEqual(['building-a'])
    expect(assignmentRepoMocks.findBuildingIdsByUser).toHaveBeenCalledWith(expect.anything(), 'owner-user')
  })

  it('returns an empty scope for an owner with no assignments (never global)', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue([])
    const { getAssignedBuildingIds } = await import('../../../server/utils/scope')

    await expect(getAssignedBuildingIds(event(), user('owner'))).resolves.toEqual([])
  })

  it('applies owner read 404 and write 403 outside scope', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    const { assertBuildingScope } = await import('../../../server/utils/scope')

    await expect(assertBuildingScope(event(), user('owner'), 'building-b', 'read'))
      .rejects.toMatchObject({ statusCode: 404 })
    await expect(assertBuildingScope(event(), user('owner'), 'building-b', 'write'))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('allows owner action inside scope', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    const { assertBuildingScope } = await import('../../../server/utils/scope')

    await expect(assertBuildingScope(event(), user('owner'), 'building-a', 'write'))
      .resolves.toBeUndefined()
  })
})
