import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { verifyTenantLinkToken } from '../../../server/utils/tenant-link-token'

const repo = vi.hoisted(() => ({ findIdentityMatches: vi.fn(), findByIds: vi.fn(), findAccessFacts: vi.fn() }))
const conflict = vi.hoisted(() => ({ assertWithinLimit: vi.fn(), recordAttempt: vi.fn() }))
const scope = vi.hoisted(() => ({ assertBuildingScope: vi.fn() }))
const audit = vi.hoisted(() => ({ append: vi.fn() }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: repo }))
vi.mock('../../../server/services/tenants/identity-conflict', () => ({ TenantIdentityConflictService: conflict }))
vi.mock('../../../server/utils/scope', () => scope)
vi.mock('../../../server/services/audit', () => ({ AuditService: audit }))

const SECRET = 'k'.repeat(40)
const event = { context: {} } as never
const owner = { id: 'owner-b', app_metadata: { role: 'owner' } } as AuthUser
const withId = { id: 't-1', code: 'KT-1', fullName: 'Nguyễn Văn An', phone: '0901234567', idNumber: '012345678901', idCardFrontPath: null, idCardBackPath: null }
const legacy = { ...withId, idNumber: null }
const input = (proof: string) => ({ building_id: 'b-1', phone: '0901234567', proof })

async function service() {
  return (await import('../../../server/services/tenants/link')).TenantLinkService
}

function found(tenant: Record<string, unknown>, active: string[] = []) {
  repo.findIdentityMatches.mockResolvedValue([{ tenantId: tenant.id, field: 'phone', value: tenant.phone }])
  repo.findByIds.mockResolvedValue([tenant])
  repo.findAccessFacts.mockResolvedValue(new Map([[tenant.id, { activeBuildingIds: active, historicalBuildingIds: ['old'], everContracted: true }]]))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ tenantLinkSecret: SECRET }))
  vi.stubGlobal('can', () => true)
})

describe('TenantLinkService.verify', () => {
  it('issues a token bound to actor, tenant and building when phone + ID number match', async () => {
    found(withId)
    const result = await (await service()).verify(event, owner, input('0123 4567 8901'))
    expect(result.tenant).toEqual({ id: 't-1', code: 'KT-1', fullName: 'Nguyễn Văn An', phone: '0901234567' })
    expect(verifyTenantLinkToken(SECRET, result.linkToken)).toMatchObject({ sub: 'owner-b', tid: 't-1', bid: 'b-1' })
    expect(scope.assertBuildingScope).toHaveBeenCalledWith(event, owner, 'b-1', 'write')
    expect(audit.append).toHaveBeenCalledWith(event, owner, expect.objectContaining({ action: 'tenant.link_verified', entity_id: 't-1', building_id: 'b-1' }))
  })

  it('requires the ID number when the record has one, even if the name matches', async () => {
    found(withId)
    await expect((await service()).verify(event, owner, input('Nguyễn Văn An')))
      .rejects.toMatchObject({ statusCode: 404, data: { error: { code: 'TENANT_LINK_UNVERIFIED' } } })
  })

  it('requires the ID number when the record only has ID images', async () => {
    found({ ...legacy, idCardFrontPath: 'tenant/front.jpg' })
    await expect((await service()).verify(event, owner, input('nguyễn văn an'))).rejects.toMatchObject({ statusCode: 404 })
  })

  it('accepts a normalized full name for a legacy record without ID data', async () => {
    found(legacy)
    const result = await (await service()).verify(event, owner, input('  nguyễn   VĂN an '.normalize('NFD')))
    expect(result.tenant.id).toBe('t-1')
  })

  it('returns the same 404 for an unknown phone and a wrong proof, and records one attempt', async () => {
    repo.findIdentityMatches.mockResolvedValue([])
    const unknown = await (await service()).verify(event, owner, input('012345678901')).catch(e => e)
    found(withId)
    const wrong = await (await service()).verify(event, owner, input('999999999999')).catch(e => e)
    expect(unknown.data).toEqual(wrong.data)
    expect(unknown.statusCode).toBe(404)
    expect(conflict.recordAttempt).toHaveBeenCalledTimes(2)
    for (const call of audit.append.mock.calls) {
      expect(call[2]).toMatchObject({ action: 'tenant.link_verify_failed', entity_id: null, building_id: 'b-1' })
      expect(JSON.stringify(call[2])).not.toMatch(/0901234567|012345678901|999999999999/)
    }
  })

  it('reports a busy tenant only after identity is proven', async () => {
    found(withId, ['b-other'])
    const error = await (await service()).verify(event, owner, input('012345678901')).catch(e => e)
    expect(error).toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_BUSY' } } })
    expect(JSON.stringify(error.data)).not.toContain('b-other')
  })

  it('fails closed with 503 when the secret is missing', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ tenantLinkSecret: '' }))
    await expect((await service()).verify(event, owner, input('012345678901')))
      .rejects.toMatchObject({ statusCode: 503, data: { error: { code: 'TENANT_LINK_DISABLED' } } })
    expect(repo.findIdentityMatches).not.toHaveBeenCalled()
  })

  it('checks the rate limit before looking up identities', async () => {
    conflict.assertWithinLimit.mockRejectedValueOnce(Object.assign(new Error('limited'), { statusCode: 429 }))
    await expect((await service()).verify(event, owner, input('012345678901'))).rejects.toMatchObject({ statusCode: 429 })
    expect(repo.findIdentityMatches).not.toHaveBeenCalled()
  })

  it('denies actors without contract create capability', async () => {
    vi.stubGlobal('can', () => false)
    await expect((await service()).verify(event, owner, input('012345678901'))).rejects.toMatchObject({ statusCode: 403 })
  })
})
