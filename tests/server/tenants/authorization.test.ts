import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can } from '../../../server/utils/permissions'
const repo = vi.hoisted(() => ({ findByIdentifier: vi.fn(), findByIds: vi.fn(), findAccessFacts: vi.fn(), findCreatedTenantIdsByActor: vi.fn() }))
const scope = vi.hoisted(() => ({ getAssignedBuildingIds: vi.fn(), canDeleteMasterData: vi.fn() }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: repo }))
vi.mock('../../../server/utils/scope', () => scope)
const event = { context: {} } as never
const actor = (role: string) => ({ id: 'actor', app_metadata: { role } }) as AuthUser
const tenant = { id: 'canonical', code: 'CODE' }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', can)
  repo.findByIdentifier.mockResolvedValue(tenant)
  repo.findByIds.mockResolvedValue([tenant])
  repo.findCreatedTenantIdsByActor.mockResolvedValue([])
  scope.getAssignedBuildingIds.mockResolvedValue(['a'])
})
async function authorization() { return (await import('../../../server/services/tenants/authorization')).TenantAuthorizationService }
describe('tenant authorization', () => {
  it.each([
    ['admin', ['b'], ['b'], false, 'full'],
    ['admin', [], [], false, 'full'],
    ['admin', [], ['a'], false, 'full'],
    ['admin', ['a', 'b'], ['a', 'b'], false, 'full'],
    ['manager', ['a', 'b'], ['a', 'b'], false, 'basic'],
    ['manager', ['b'], ['a', 'b'], false, 'basic'],
    ['manager', ['b'], ['b'], true, 'none'],
    ['manager', [], ['a'], true, 'basic'],
    ['manager', [], ['b'], true, 'none'],
    ['manager', [], [], false, 'none'],
    ['owner', ['a'], ['a'], false, 'full'],
    ['manager', ['a'], ['a'], false, 'full'],
    ['owner', ['a', 'b'], ['a', 'b'], false, 'basic'],
    ['owner', ['b'], ['a', 'b'], false, 'basic'],
    ['owner', ['b'], ['b'], true, 'none'],
    ['owner', [], ['a'], true, 'basic'],
    ['owner', [], ['b'], true, 'none'],
    ['owner', [], [], true, 'full'],
    ['manager', [], [], true, 'full'],
    ['owner', [], [], false, 'none'],
  ])('%s active %j history %j creator %s -> %s', async (role, active, history, creator, expected) => {
    repo.findAccessFacts.mockResolvedValue(new Map([['canonical', { activeBuildingIds: active, historicalBuildingIds: history, everContracted: history.length > 0 }]]))
    repo.findCreatedTenantIdsByActor.mockResolvedValue(creator ? ['canonical'] : [])
    const result = await (await authorization()).resolveAccess(event, actor(role), 'CODE')
    expect(result?.level).toBe(expected)
    expect(repo.findAccessFacts).toHaveBeenCalledWith(event, ['canonical'])
  })
  it('denies capabilities before identifier lookup, including admin without capability', async () => {
    vi.stubGlobal('can', () => false)
    await expect((await authorization()).assertAccess(event, actor('admin'), 'CODE', 'update_profile')).rejects.toMatchObject({ statusCode: 403 })
    expect(repo.findByIdentifier).not.toHaveBeenCalled()
  })
  it('fails closed for absent facts even for creator', async () => {
    repo.findAccessFacts.mockResolvedValue(new Map())
    repo.findCreatedTenantIdsByActor.mockResolvedValue(['canonical'])
    await expect((await authorization()).assertAccess(event, actor('owner'), 'CODE', 'read_profile')).rejects.toMatchObject({ statusCode: 404 })
  })
  it('denies basic writes and sorts/deduplicates relationship snapshots', async () => {
    repo.findAccessFacts.mockResolvedValue(new Map([['canonical', { activeBuildingIds: ['b', 'a', 'b'], historicalBuildingIds: ['b', 'a'], everContracted: true }]]))
    const auth = await authorization()
    expect((await auth.resolveAccess(event, actor('owner'), 'CODE'))?.activeBuildingIds).toEqual(['a', 'b'])
    await expect(auth.assertAccess(event, actor('owner'), 'CODE', 'update_profile')).rejects.toMatchObject({ statusCode: 403 })
  })
})
