import { beforeEach, describe, expect, it, vi } from 'vitest'

const repo = vi.hoisted(() => ({ findIdentityMatches: vi.fn() }))
const limit = vi.hoisted(() => ({ peek: vi.fn(), record: vi.fn() }))
const authz = vi.hoisted(() => ({ resolveAccessMany: vi.fn() }))
const audit = vi.hoisted(() => ({ append: vi.fn() }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: repo }))
vi.mock('../../../server/repositories/tenants/identity-conflict-limit', () => ({ TenantIdentityConflictLimitRepository: limit }))
vi.mock('../../../server/services/tenants/authorization', () => ({ TenantAuthorizationService: authz }))
vi.mock('../../../server/services/audit', () => ({ AuditService: audit }))
vi.stubGlobal('useRuntimeConfig', () => ({}))
vi.stubGlobal('setResponseHeader', vi.fn())

const event = {} as never
const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as never
const levels = (map: Record<string, 'full' | 'basic' | 'none'>) =>
  new Map(Object.entries(map).map(([id, level]) => [id, { level }]))

beforeEach(() => {
  vi.clearAllMocks()
  limit.peek.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  repo.findIdentityMatches.mockResolvedValue([])
})

async function service() {
  return (await import('../../../server/services/tenants/identity-conflict')).TenantIdentityConflictService
}

describe('TenantIdentityConflictService.assertAvailable', () => {
  it('passes when nothing matches and records nothing', async () => {
    await (await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'create')
    expect(limit.record).not.toHaveBeenCalled()
  })

  it('skips lookup and limit when no identity field is present', async () => {
    await (await service()).assertAvailable(event, owner, { idNumber: null }, 'update')
    expect(limit.peek).not.toHaveBeenCalled()
    expect(repo.findIdentityMatches).not.toHaveBeenCalled()
  })

  it('returns TENANT_DUPLICATE with field and tenant id for full access', async () => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-full', field: 'phone', value: '0901234567' }])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-full': 'full' }))
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'create')).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { code: 'TENANT_DUPLICATE', details: { fieldErrors: { phone: ['Số điện thoại đã tồn tại'] }, existingTenantId: 't-full' } } },
    })
    expect(limit.record).toHaveBeenCalledWith(event, expect.objectContaining({ units: 1 }))
    expect(audit.append).not.toHaveBeenCalled()
  })

  it.each(['basic', 'none'] as const)('returns the generic conflict without details for %s access', async (level) => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-out', field: 'id_number', value: '012345678901' }])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-out': level }))
    const error = await (await service()).assertAvailable(event, owner, { idNumber: '012345678901' }, 'create').catch(e => e)
    expect(error).toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' } } })
    expect(error.data.error.details).toBeUndefined()
    expect(JSON.stringify(error.data)).not.toContain('t-out')
    expect(audit.append).toHaveBeenCalledWith(event, owner, expect.objectContaining({
      action: 'tenant.identity_conflict', entity_id: 't-out', after_data: { fields: ['id_number'], source: 'create' },
    }))
  })

  it('returns the generic conflict when any matched tenant is out of scope', async () => {
    repo.findIdentityMatches.mockResolvedValue([
      { tenantId: 't-full', field: 'phone', value: '0901234567' },
      { tenantId: 't-out', field: 'id_number', value: '012345678901' },
    ])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-full': 'full', 't-out': 'none' }))
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567', idNumber: '012345678901' }, 'update'))
      .rejects.toMatchObject({ data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
  })

  it('always uses the generic conflict for the tenant portal without resolving access', async () => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-any', field: 'phone', value: '0901234567' }])
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'portal'))
      .rejects.toMatchObject({ data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
    expect(authz.resolveAccessMany).not.toHaveBeenCalled()
  })

  it('rejects with 429 before any lookup when the limit is exhausted', async () => {
    limit.peek.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 })
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'create')).rejects.toMatchObject({
      statusCode: 429, data: { error: { code: 'RATE_LIMITED', details: { retryAfterSeconds: 120 } } },
    })
    expect(repo.findIdentityMatches).not.toHaveBeenCalled()
  })
})

describe('TenantIdentityConflictService.rejectUniqueViolation', () => {
  it('falls back to the generic conflict when the racing row is no longer visible', async () => {
    await expect((await service()).rejectUniqueViolation(event, owner, { phone: '0901234567' }, 'create'))
      .rejects.toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
    expect(limit.record).toHaveBeenCalledWith(event, expect.objectContaining({ units: 1 }))
  })
})

describe('conflict privacy and accounting', () => {
  it('records one conflict unit and one redacted audit per matching tenant', async () => {
    const matches = [
      { tenantId: 't-out', field: 'phone' as const, value: '0900000000' },
      { tenantId: 't-out', field: 'id_number' as const, value: 'FAKE-ID' },
    ]
    const svc = await service()
    await svc.recordConflicts(event, owner, [...matches, matches[0]!], 'import', 3)
    expect(limit.record).toHaveBeenCalledWith(event, {
      subjectHash: expect.stringMatching(/^[a-f0-9]{64}$/), units: 3, windowSeconds: 900,
    })
    expect(audit.append).toHaveBeenCalledTimes(1)
    expect(audit.append).toHaveBeenCalledWith(event, owner, {
      building_id: null, action: 'tenant.identity_conflict', entity_type: 'tenant', entity_id: 't-out',
      after_data: { fields: ['phone', 'id_number'], source: 'import' },
    })
    expect(JSON.stringify(audit.append.mock.calls)).not.toContain('FAKE-ID')
    expect(JSON.stringify(audit.append.mock.calls)).not.toContain('0900000000')
  })

  it('does not count or audit zero units', async () => {
    await (await service()).recordConflicts(event, owner, [], 'import', 0)
    expect(limit.record).not.toHaveBeenCalled()
    expect(audit.append).not.toHaveBeenCalled()
  })

  it('preserves self exclusion for the race lookup and returns specific full-access conflicts', async () => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-full', field: 'id_number', value: 'FAKE-ID' }])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-full': 'full' }))
    await expect((await service()).rejectUniqueViolation(event, owner, { idNumber: 'FAKE-ID', excludeId: 't-self' }, 'update'))
      .rejects.toMatchObject({ data: { error: { code: 'TENANT_DUPLICATE', details: { existingTenantId: 't-full', fieldErrors: { id_number: ['Số CMND/CCCD đã tồn tại'] } } } } })
    expect(repo.findIdentityMatches).toHaveBeenCalledWith(event, { phones: [], idNumbers: ['FAKE-ID'], excludeId: 't-self' })
    expect(limit.record).toHaveBeenCalledTimes(1)
  })

  it('fails closed if authorization returns no context', async () => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 'missing', field: 'phone', value: '0900000000' }])
    authz.resolveAccessMany.mockResolvedValue(new Map())
    await expect((await service()).assertAvailable(event, owner, { phone: '0900000000' }, 'create'))
      .rejects.toMatchObject({ data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
  })
})
