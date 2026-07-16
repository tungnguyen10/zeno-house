import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
  findByUserAndBuilding: vi.fn(),
}))
const tenantLinkRepoMocks = vi.hoisted(() => ({
  getTenantIdForAuthUser: vi.fn(),
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))
vi.mock('../../../server/repositories/tenant-portal/links', () => ({
  getTenantIdForAuthUser: tenantLinkRepoMocks.getTenantIdForAuthUser,
}))

function user(role: 'admin' | 'owner' | 'manager' | 'tenant', id = `${role}-user`): AuthUser {
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

  it('grants master-data deletes to owners within their scope regardless of the flag', async () => {
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-a'])
    const { canDeleteMasterData } = await import('../../../server/utils/scope')

    await expect(canDeleteMasterData(event(), user('owner'), 'building-a')).resolves.toBe(true)
    await expect(canDeleteMasterData(event(), user('owner'), 'building-z')).resolves.toBe(false)
    expect(assignmentRepoMocks.findByUserAndBuilding).not.toHaveBeenCalled()
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

describe('tenant scope resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the tenant linked to the authenticated user', async () => {
    tenantLinkRepoMocks.getTenantIdForAuthUser.mockResolvedValue('tenant-a')
    const requestEvent = event()
    const tenantUser = user('tenant', 'auth-user-a')
    const { resolveTenantId } = await import('../../../server/utils/scope')

    await expect(resolveTenantId(requestEvent, tenantUser)).resolves.toBe('tenant-a')
    expect(tenantLinkRepoMocks.getTenantIdForAuthUser)
      .toHaveBeenCalledWith(requestEvent, 'auth-user-a')
  })

  it.each([
    ['missing', null],
    ['disabled', null],
  ])('uses the same not-found response for a %s link', async (_state, repositoryResult) => {
    tenantLinkRepoMocks.getTenantIdForAuthUser.mockResolvedValue(repositoryResult)
    const { resolveTenantId } = await import('../../../server/utils/scope')

    await expect(resolveTenantId(event(), user('tenant'))).rejects.toMatchObject({
      statusCode: 404,
      data: { error: { code: 'NOT_FOUND' } },
    })
  })

  it('ignores tenant identifiers supplied by the client', async () => {
    tenantLinkRepoMocks.getTenantIdForAuthUser.mockResolvedValue('linked-tenant')
    const requestEvent = {
      context: {},
      query: { tenant_id: 'query-tenant' },
      body: { tenant_id: 'body-tenant' },
    } as never
    const { resolveTenantId } = await import('../../../server/utils/scope')

    await expect(resolveTenantId(requestEvent, user('tenant', 'auth-user')))
      .resolves.toBe('linked-tenant')
    expect(tenantLinkRepoMocks.getTenantIdForAuthUser)
      .toHaveBeenCalledWith(requestEvent, 'auth-user')
  })
})
