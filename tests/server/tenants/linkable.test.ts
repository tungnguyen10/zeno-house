import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { signTenantLinkToken } from '../../../server/utils/tenant-link-token'

const repo = vi.hoisted(() => ({ findByIdentifier: vi.fn(), findByIds: vi.fn(), findAccessFacts: vi.fn(), findCreatedTenantIdsByActor: vi.fn() }))
const scope = vi.hoisted(() => ({ getAssignedBuildingIds: vi.fn() }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: repo }))
vi.mock('../../../server/utils/scope', () => scope)

const SECRET = 's'.repeat(40)
const event = { context: {} } as never
const owner = { id: 'owner-b', app_metadata: { role: 'owner' } } as AuthUser
const tenant = { id: 'tenant-1', code: 'KT-1' }

function facts(active: string[], history: string[]) {
  repo.findAccessFacts.mockResolvedValue(new Map([['tenant-1', { activeBuildingIds: active, historicalBuildingIds: history, everContracted: history.length > 0 }]]))
}

async function service() {
  return (await import('../../../server/services/tenants/authorization')).TenantAuthorizationService
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ tenantLinkSecret: SECRET }))
  repo.findByIds.mockResolvedValue([tenant])
  repo.findCreatedTenantIdsByActor.mockResolvedValue([])
  scope.getAssignedBuildingIds.mockResolvedValue(['b-1'])
})

describe('TenantAuthorizationService.assertLinkable', () => {
  it('allows a tenant the actor fully manages', async () => {
    facts([], [])
    repo.findCreatedTenantIdsByActor.mockResolvedValue(['tenant-1'])
    await expect((await service()).assertLinkable(event, owner, 'tenant-1', { buildingId: 'b-1' })).resolves.toBeUndefined()
  })

  it('allows a former tenant of the actor (basic access) to rent again', async () => {
    facts([], ['b-1'])
    await expect((await service()).assertLinkable(event, owner, 'tenant-1', { buildingId: 'b-1' })).resolves.toBeUndefined()
  })

  it('rejects an out-of-scope tenant without a token as not found', async () => {
    facts([], ['other'])
    await expect((await service()).assertLinkable(event, owner, 'tenant-1', { buildingId: 'b-1' }))
      .rejects.toMatchObject({ statusCode: 404, data: { error: { code: 'TENANT_NOT_LINKABLE' } } })
  })

  it('rejects an unknown tenant id as not found', async () => {
    repo.findByIds.mockResolvedValue([])
    repo.findAccessFacts.mockResolvedValue(new Map())
    await expect((await service()).assertLinkable(event, owner, 'tenant-x', { buildingId: 'b-1' }))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('accepts a valid link token bound to the actor, tenant and building', async () => {
    const { token } = signTenantLinkToken(SECRET, { sub: 'owner-b', tid: 'tenant-1', bid: 'b-1' })
    await expect((await service()).assertLinkable(event, owner, 'tenant-1', { buildingId: 'b-1', linkToken: token })).resolves.toBeUndefined()
    expect(repo.findAccessFacts).not.toHaveBeenCalled()
  })

  it.each([
    ['another actor', { sub: 'owner-c', tid: 'tenant-1', bid: 'b-1' }],
    ['another tenant', { sub: 'owner-b', tid: 'tenant-2', bid: 'b-1' }],
    ['another building', { sub: 'owner-b', tid: 'tenant-1', bid: 'b-2' }],
  ])('rejects a token issued for %s', async (_label, claims) => {
    facts([], ['other'])
    const { token } = signTenantLinkToken(SECRET, claims)
    await expect((await service()).assertLinkable(event, owner, 'tenant-1', { buildingId: 'b-1', linkToken: token }))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('ignores tokens when the secret is not configured', async () => {
    const { token } = signTenantLinkToken(SECRET, { sub: 'owner-b', tid: 'tenant-1', bid: 'b-1' })
    vi.stubGlobal('useRuntimeConfig', () => ({ tenantLinkSecret: '' }))
    facts([], ['other'])
    await expect((await service()).assertLinkable(event, owner, 'tenant-1', { buildingId: 'b-1', linkToken: token }))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
