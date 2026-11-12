import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Tenant } from '../../app/types/tenants'
import { BuildingVisibilityRepository } from '../../server/repositories/buildings/visibility'

const repoMocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByIds: vi.fn(),
  findAccessFacts: vi.fn(),
  findUnassignedTenantIds: vi.fn(),
  findByIdentifier: vi.fn(),
  findActiveAssignmentByTenantId: vi.fn(),
  findById: vi.fn(),
  hasContractInBuildings: vi.fn(),
  findIdentityMatches: vi.fn(),
  findCreatedTenantIdsByActor: vi.fn(),
  wasCreatedByActor: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  countActiveContractsForTenant: vi.fn(),
  countActiveOccupanciesForTenant: vi.fn(),
  findActiveBuildingIdForTenant: vi.fn(),
  softArchive: vi.fn(),
  setStatus: vi.fn(),
  insertMany: vi.fn(),
}))
const auditMocks = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))
vi.mock('../../server/services/audit', () => ({ AuditService: auditMocks }))

const limitMocks = vi.hoisted(() => ({ peek: vi.fn(), record: vi.fn() }))
vi.mock('../../server/repositories/tenants/identity-conflict-limit', () => ({ TenantIdentityConflictLimitRepository: limitMocks }))
vi.stubGlobal('useRuntimeConfig', () => ({}))
vi.stubGlobal('setResponseHeader', vi.fn())

const bulkRepoMocks = vi.hoisted(() => ({ resolveSnapshots: vi.fn(), execute: vi.fn() }))
const tenantAccountLinkRepoMocks = vi.hoisted(() => ({
  getByTenantId: vi.fn(),
}))

vi.mock('../../server/repositories/tenants', () => ({
  TenantRepository: repoMocks,
}))
vi.mock('../../server/repositories/bulk-actions', () => ({ BulkActionRepository: bulkRepoMocks }))
const statusRepo = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../../server/repositories/tenants/bulk-status', () => ({ TenantBulkStatusRepository: statusRepo }))
vi.mock('../../server/repositories/tenant-portal/account-links', () => ({
  TenantAccountLinkRepository: tenantAccountLinkRepoMocks,
}))

const buildingRepoMocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
}))

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
  findByUserAndBuilding: vi.fn(),
}))

vi.mock('../../server/repositories/buildings', () => ({
  BuildingRepository: buildingRepoMocks,
}))

vi.mock('../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

const requireAuthMock = vi.hoisted(() => vi.fn())

vi.mock('../../server/utils/auth', () => ({
  requireAuth: requireAuthMock,
}))

vi.stubGlobal('requireAuth', requireAuthMock)

type EventContext = {
  query?: Record<string, unknown>
  body?: unknown
  params?: Record<string, string>
  statusCode?: number
}
type MockEvent = { context: EventContext }

function makeEvent(opts: { query?: Record<string, unknown>; body?: unknown; params?: Record<string, string> } = {}): MockEvent {
  return { context: { query: opts.query, body: opts.body, params: opts.params } }
}

vi.stubGlobal('defineEventHandler', (fn: (event: MockEvent) => unknown) => fn)
vi.stubGlobal('getQuery', (event: MockEvent) => event.context.query ?? {})
vi.stubGlobal('getRouterParam', (event: MockEvent, key: string) => event.context.params?.[key])
vi.stubGlobal('readBody', async (event: MockEvent) => event.context.body)
vi.stubGlobal('setResponseStatus', (event: MockEvent, code: number) => {
  event.context.statusCode = code
})

const CAPS: Record<string, Set<string>> = {
  admin: new Set(['tenants.read', 'tenants.create', 'tenants.update', 'tenants.delete']),
  owner: new Set(['tenants.read', 'tenants.create', 'tenants.update', 'tenants.delete']),
  manager: new Set(['tenants.read']),
}
vi.stubGlobal('can', (user: { app_metadata?: { role?: string } }, capability: string) => {
  const role = user?.app_metadata?.role ?? 'admin'
  return CAPS[role]?.has(capability) ?? false
})

function buildTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: overrides.id ?? 't-1',
    code: overrides.code ?? 'nva-2026-0001',
    fullName: overrides.fullName ?? 'Nguyen Van A',
    phone: overrides.phone ?? '0901234567',
    email: overrides.email ?? null,
    idNumber: overrides.idNumber ?? null,
    dateOfBirth: overrides.dateOfBirth ?? null,
    gender: overrides.gender ?? null,
    occupation: overrides.occupation ?? null,
    idIssuedDate: overrides.idIssuedDate ?? null,
    idIssuedPlace: overrides.idIssuedPlace ?? null,
    idCardFrontPath: overrides.idCardFrontPath ?? null,
    idCardBackPath: overrides.idCardBackPath ?? null,
    idCardFrontSignedUrl: overrides.idCardFrontSignedUrl ?? null,
    idCardBackSignedUrl: overrides.idCardBackSignedUrl ?? null,
    emergencyContactName: overrides.emergencyContactName ?? null,
    emergencyContactPhone: overrides.emergencyContactPhone ?? null,
    permanentAddress: overrides.permanentAddress ?? null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? 'active',
    hasActiveContract: overrides.hasActiveContract,
    activeAssignment: overrides.activeAssignment ?? null,
    createdAt: overrides.createdAt ?? '2026-06-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-01T00:00:00.000Z',
  }
}

function asAdmin() {
  requireAuthMock.mockResolvedValue({
    id: 'user-admin',
    sub: 'user-admin',
    app_metadata: { role: 'admin' },
  })
}

function asManager() {
  requireAuthMock.mockResolvedValue({
    id: 'user-manager',
    sub: 'user-manager',
    app_metadata: { role: 'manager' },
  })
}

function asOwner() {
  requireAuthMock.mockResolvedValue({
    id: 'user-owner',
    sub: 'user-owner',
    app_metadata: { role: 'owner' },
  })
}

interface ApiError {
  statusCode?: number
  data?: { error?: { code?: string; details?: unknown; message?: string } }
}

async function expectError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
    throw new Error('Expected promise to reject')
  }
  catch (e) {
    return e as ApiError
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  repoMocks.findByIds.mockImplementation(async (_event, ids: string[]) => ids.filter(id => id !== 'missing').map(id => buildTenant({ id })))
  repoMocks.findAccessFacts.mockImplementation(async (_event, ids: string[]) => new Map(ids.map(id => [id, { activeBuildingIds: [], historicalBuildingIds: [], everContracted: false }])))
  statusRepo.execute.mockImplementation(async (_event, _action, items: Array<{ id: string }>) => items.map(item => ({ id: item.id, succeeded: true, reason: null })))
  repoMocks.findIdentityMatches.mockResolvedValue([])
  limitMocks.peek.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  repoMocks.findActiveBuildingIdForTenant.mockResolvedValue(null)
  repoMocks.findActiveAssignmentByTenantId.mockResolvedValue(null)
  repoMocks.findCreatedTenantIdsByActor.mockResolvedValue([])
  repoMocks.wasCreatedByActor.mockResolvedValue(false)
  tenantAccountLinkRepoMocks.getByTenantId.mockResolvedValue(null)
  assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'])
  assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue(null)
  repoMocks.findUnassignedTenantIds.mockResolvedValue([])
  vi.mocked(BuildingVisibilityRepository.findHiddenIds).mockResolvedValue([])
  vi.mocked(BuildingVisibilityRepository.findVisibleIds).mockResolvedValue([])
  bulkRepoMocks.execute.mockImplementation((_event, _entity, _action, ids: string[]) =>
    Promise.resolve(ids.map(id => ({ id, succeeded: true, reason: null }))),
  )
  bulkRepoMocks.resolveSnapshots.mockResolvedValue(new Map())
  repoMocks.insertMany.mockImplementation(async (_event, inputs: Array<{ full_name: string, phone: string }>) =>
    Promise.all(inputs.map(input => repoMocks.insert(_event, input))),
  )
})

// ---------------------------------------------------------------------------
// GET /api/tenants
// ---------------------------------------------------------------------------

describe('GET /api/tenants', () => {
  it('returns pagination envelope with defaults when no query', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [buildTenant()], total: 1 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    const res = await handler(makeEvent({ query: {} })) as {
      data: Tenant[]
      meta: { total: number; page: number; limit: number; totalPages: number }
    }

    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      page: 1,
      limit: 20,
      sort: 'full_name',
      order: 'asc',
    }))
    expect(res.data).toHaveLength(1)
    expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 })
  })

  it('forwards search query to repository', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: { q: 'nguyen' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ q: 'nguyen' }))
  })

  it('forwards building_id filter after resolving identifier', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    buildingRepoMocks.findByIdentifier.mockResolvedValue({ id: 'b-uuid', slug: 'toa-a' })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: { building_id: 'toa-a' } }))
    expect(buildingRepoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ building_id: 'b-uuid' }))
  })

  it('forwards contract_state filter', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: { contract_state: 'with_contract' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ contract_state: 'with_contract' }))
  })

  it('normalizes single status to array', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: { status: 'archived' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: ['archived'] }))
  })

  it('accepts multiple statuses', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: { status: ['active', 'archived'] } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: ['active', 'archived'] }))
  })

  it('default excludes archived (status undefined when not provided)', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: {} }))
    const call = repoMocks.findAll.mock.calls[0]?.[1] as { status?: unknown }
    expect(call?.status).toBeUndefined()
  })

  it('includes owner-created orphan tenant ids for scoped owner list without building filter', async () => {
    asOwner()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    repoMocks.findCreatedTenantIdsByActor.mockResolvedValue(['orphan-1'])
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: {} }))

    expect(repoMocks.findCreatedTenantIdsByActor).toHaveBeenCalledWith(expect.anything(), 'user-owner')
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ include_ids: ['orphan-1'] }))
  })

  it('includes unassigned tenants in admin lists when hidden buildings constrain visibility', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    repoMocks.findUnassignedTenantIds.mockResolvedValue(['unassigned-1'])
    vi.mocked(BuildingVisibilityRepository.findHiddenIds).mockResolvedValue(['hidden-building'])
    vi.mocked(BuildingVisibilityRepository.findVisibleIds).mockResolvedValue(['visible-building'])
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: {} }))

    expect(repoMocks.findUnassignedTenantIds).toHaveBeenCalledWith(expect.anything())
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingIds: ['visible-building'],
      include_ids: ['unassigned-1'],
    }))
  })

  it('forwards sort by full_name and created_at', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/tenants/index.get')

    await handler(makeEvent({ query: { sort: 'full_name', order: 'asc' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sort: 'full_name', order: 'asc' }))

    await handler(makeEvent({ query: { sort: 'created_at', order: 'desc' } }))
    expect(repoMocks.findAll).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ sort: 'created_at', order: 'desc' }))
  })

  it('rejects an invalid sort field with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/index.get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ query: { sort: 'secret' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an invalid status value with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/index.get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ query: { status: 'banned' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// POST /api/tenants
// ---------------------------------------------------------------------------

describe('POST /api/tenants', () => {
  it('creates a tenant and returns 201 envelope', async () => {
    asAdmin()
    const tenant = buildTenant({ id: 'new-1' })
    repoMocks.insert.mockResolvedValue(tenant)
    const { default: handler } = await import('../../server/api/tenants/index.post')

    const event = makeEvent({ body: { full_name: 'Nguyen Van A', phone: '0901234567' } })
    const res = await handler(event) as { data: Tenant }

    expect(res.data.id).toBe('new-1')
    expect((event as MockEvent).context.statusCode).toBe(201)
  })

  it('rejects invalid payload with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: '' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })

  it('forbids managers from creating', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/tenants/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Nguyen Van A', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(403)
  })

  it('rejects duplicate id_number with 409', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'id_number', value: '012345678901' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      body: { full_name: 'Nguyen Van A', phone: '0901234567', id_number: '012345678901' },
    }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
  })

  it('rejects duplicate phone with 409', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'phone', value: '0901234567' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      body: { full_name: 'Nguyen Van A', phone: '0901234567' },
    }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
  })
})

// ---------------------------------------------------------------------------
// GET /api/tenants/[id]
// ---------------------------------------------------------------------------

describe('GET /api/tenants/[id]', () => {
  it('returns tenant by id with active assignment metadata', async () => {
    asAdmin()
    const assignment = {
      contractId: 'contract-1',
      roomId: 'room-1',
      roomNumber: 'A101',
      buildingId: 'building-1',
      buildingName: 'Toa A',
      buildingSlug: 'toa-a',
      assignmentRole: 'roommate' as const,
      primaryTenantName: 'Le Thi B',
    }
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-9' }))
    repoMocks.findActiveAssignmentByTenantId.mockResolvedValue(assignment)
    const { default: handler } = await import('../../server/api/tenants/[id].get')

    const res = await handler(makeEvent({ params: { id: 't-9' } })) as { data: Tenant }
    expect(res.data.id).toBe('t-9')
    expect(res.data.activeAssignment).toMatchObject(assignment)
    expect(res.data.hasActiveContract).toBe(true)
    expect(repoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 't-9')
    expect(repoMocks.findActiveAssignmentByTenantId).toHaveBeenCalledWith(expect.anything(), 't-9')
  })

  it('returns tenant by code', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ code: 'nva-2026-0001' }))
    const { default: handler } = await import('../../server/api/tenants/[id].get')

    await handler(makeEvent({ params: { id: 'nva-2026-0001' } }))
    expect(repoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'nva-2026-0001')
  })

  it('returns 404 when not found', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(null)
    const { default: handler } = await import('../../server/api/tenants/[id].get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'missing' } }))))
    expect(err.statusCode).toBe(404)
  })

  it('allows owner to get tenant without in-scope contract when owner created that tenant', async () => {
    asOwner()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-owner-orphan' }))
    repoMocks.hasContractInBuildings.mockResolvedValue(false)
    repoMocks.wasCreatedByActor.mockResolvedValue(true)
    repoMocks.findCreatedTenantIdsByActor.mockResolvedValue(['t-1', 't-owner-orphan', 'orphan-owned'])
    const { default: handler } = await import('../../server/api/tenants/[id].get')

    const res = await handler(makeEvent({ params: { id: 't-owner-orphan' } })) as { data: Tenant }
    expect(res.data.id).toBe('t-owner-orphan')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/tenants/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/tenants/[id]', () => {
  it('updates and returns the tenant', async () => {
    asAdmin()
    const tenant = buildTenant({ id: 't-2', fullName: 'Đã đổi' })
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-2' }))
    repoMocks.update.mockResolvedValue(tenant)
    const { default: handler } = await import('../../server/api/tenants/[id].patch')

    const res = await handler(makeEvent({ params: { id: 't-2' }, body: { full_name: 'Đã đổi' } })) as { data: Tenant }
    expect(res.data.fullName).toBe('Đã đổi')
  })

  it('forbids managers from updating', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/tenants/[id].patch')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 't-1' }, body: { full_name: 'Nguyen Van A' } }))))
    expect(err.statusCode).toBe(403)
  })

  it('rejects invalid payload with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/[id].patch')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 't-1' }, body: { phone: 'a'.repeat(50) } }))))
    expect(err.statusCode).toBe(422)
  })

  it('rejects duplicate phone with 409', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-1' }))
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 't-2', field: 'phone', value: '0909999888' }])
    const { default: handler } = await import('../../server/api/tenants/[id].patch')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      params: { id: 't-1' },
      body: { phone: '0909999888' },
    }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/tenants/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/tenants/[id]', () => {
  it('returns 204 when tenant has no blockers', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-1' }))
    repoMocks.countActiveContractsForTenant.mockResolvedValue(0)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    repoMocks.remove.mockResolvedValue(undefined)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const event = makeEvent({ params: { id: 't-1' }, query: {}, body: { reason: 'cleanup' } })
    await handler(event)
    expect((event as MockEvent).context.statusCode).toBe(204)
    expect(repoMocks.remove).toHaveBeenCalledWith(expect.anything(), 't-1')
  })

  it('returns 409 when active contract exists', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-2' }))
    repoMocks.countActiveContractsForTenant.mockResolvedValue(1)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 't-2' }, query: {}, body: { reason: 'cleanup' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('CONFLICT')
    expect(err.data?.error?.details).toMatchObject({ activeContracts: 1, activeOccupancies: 0 })
  })

  it('returns 409 when active occupancy exists', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-3' }))
    repoMocks.countActiveContractsForTenant.mockResolvedValue(0)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(2)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 't-3' }, query: {}, body: { reason: 'cleanup' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.details).toMatchObject({ activeOccupancies: 2 })
  })

  it('returns 409 while a tenant portal account link exists', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-portal' }))
    repoMocks.countActiveContractsForTenant.mockResolvedValue(0)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    tenantAccountLinkRepoMocks.getByTenantId.mockResolvedValue({
      authUserId: 'auth-tenant',
      tenantId: 't-portal',
    })
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      params: { id: 't-portal' },
      query: {},
      body: { reason: 'cleanup' },
    }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.details).toMatchObject({ portalAccounts: 1 })
    expect(repoMocks.remove).not.toHaveBeenCalled()
  })

  it('soft-archives and returns 200 with data when force=true', async () => {
    asAdmin()
    const archived = buildTenant({ id: 't-4', status: 'archived' })
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-4' }))
    repoMocks.softArchive.mockResolvedValue(archived)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const event = makeEvent({ params: { id: 't-4' }, query: { force: 'true' }, body: { reason: 'archive' } })
    const res = await handler(event) as { data: Tenant }
    expect(res.data.status).toBe('archived')
    expect(repoMocks.softArchive).toHaveBeenCalledWith(expect.anything(), 't-4')
    expect(repoMocks.countActiveContractsForTenant).not.toHaveBeenCalled()
  })

  it('forbids managers from force-deleting without a building grant', async () => {
    asManager()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant())
    repoMocks.findAccessFacts.mockResolvedValue(new Map([['t-1', { activeBuildingIds: ['0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'], historicalBuildingIds: ['0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'], everContracted: true }]]))
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      params: { id: 't-1' },
      query: { force: 'true' },
      body: { reason: 'archive', building_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333' },
    }))))
    expect(err.statusCode).toBe(403)
  })

  it('allows owner to hard-delete an orphan tenant they created', async () => {
    asOwner()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-owner-orphan' }))
    repoMocks.findActiveBuildingIdForTenant.mockResolvedValue(null)
    repoMocks.wasCreatedByActor.mockResolvedValue(true)
    repoMocks.findCreatedTenantIdsByActor.mockResolvedValue(['t-1', 't-owner-orphan', 'orphan-owned'])
    repoMocks.countActiveContractsForTenant.mockResolvedValue(0)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    repoMocks.remove.mockResolvedValue(undefined)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const event = makeEvent({ params: { id: 't-owner-orphan' }, body: { reason: 'cleanup' } })
    await handler(event)
    expect((event as MockEvent).context.statusCode).toBe(204)
    expect(repoMocks.findCreatedTenantIdsByActor).toHaveBeenCalledWith(expect.anything(), 'user-owner')
    expect(repoMocks.remove).toHaveBeenCalledWith(expect.anything(), 't-owner-orphan')
  })

  it('forbids owner from hard-deleting orphan tenant created by another actor', async () => {
    asOwner()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-owner-forbidden' }))
    repoMocks.findActiveBuildingIdForTenant.mockResolvedValue(null)
    repoMocks.wasCreatedByActor.mockResolvedValue(false)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      params: { id: 't-owner-forbidden' },
      body: { reason: 'cleanup' },
    }))))
    expect(err.statusCode).toBe(404)
  })

  it('requires a delete reason', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 't-1' }, body: {} }))))
    expect(err.statusCode).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// POST /api/tenants/bulk
// ---------------------------------------------------------------------------

describe('POST /api/tenants/bulk', () => {
  it('archives multiple tenants successfully', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockImplementation((_e: unknown, id: string) =>
      Promise.resolve(buildTenant({ id })),
    )
    repoMocks.setStatus.mockImplementation((_e: unknown, id: string, status: 'active' | 'archived') =>
      Promise.resolve(buildTenant({ id, status })),
    )
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'archive', ids: ['a', 'b'] } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['a', 'b'])
    expect(res.data.failed).toEqual([])
    expect(statusRepo.execute).toHaveBeenCalledWith(expect.anything(), 'archive', [{ id: 'a', expected_building_ids: [] }, { id: 'b', expected_building_ids: [] }])
  })

  it('activate flips status to active', async () => {
    asAdmin()
    const archived = buildTenant({ id: 'a', status: 'archived' })
    const active = buildTenant({ id: 'a', status: 'active' })
    repoMocks.findByIdentifier.mockResolvedValue(archived)
    repoMocks.setStatus.mockResolvedValue(active)
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'activate', ids: ['a'] } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['a'])
    expect(statusRepo.execute).toHaveBeenCalledWith(expect.anything(), 'activate', [{ id: 'a', expected_building_ids: [] }])
  })

  it('delete action reports mixed results without short-circuiting', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockImplementation((_e: unknown, id: string) => {
      if (id === 'missing') return Promise.resolve(null)
      return Promise.resolve(buildTenant({ id }))
    })
    repoMocks.countActiveContractsForTenant.mockImplementation((_e: unknown, id: string) =>
      id === 'active-contract' ? Promise.resolve(1) : Promise.resolve(0),
    )
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    repoMocks.remove.mockResolvedValue(undefined)
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'delete', ids: ['no-history', 'active-contract', 'missing'], reason: 'cleanup' } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['no-history'])
    expect(res.data.failed).toEqual(expect.arrayContaining([
      { id: 'active-contract', reason: 'has_active_contracts' },
      { id: 'missing', reason: 'not_found' },
    ]))
  })

  it('maps forbidden when owner deletes orphan tenant created by another actor', async () => {
    asOwner()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 'orphan-foreign' }))
    repoMocks.findActiveBuildingIdForTenant.mockResolvedValue(null)
    repoMocks.wasCreatedByActor.mockResolvedValue(false)
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const res = await handler(makeEvent({
      body: { action: 'delete', ids: ['orphan-foreign'], reason: 'cleanup' },
    })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual([])
    expect(res.data.failed).toEqual([{ id: 'orphan-foreign', reason: 'not_found' }])
  })

  it('allows owner bulk delete for orphan tenant they created', async () => {
    asOwner()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 'orphan-owned' }))
    repoMocks.findActiveBuildingIdForTenant.mockResolvedValue(null)
    repoMocks.wasCreatedByActor.mockResolvedValue(true)
    repoMocks.findCreatedTenantIdsByActor.mockResolvedValue(['t-1', 't-owner-orphan', 'orphan-owned'])
    repoMocks.countActiveContractsForTenant.mockResolvedValue(0)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    repoMocks.remove.mockResolvedValue(undefined)
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const res = await handler(makeEvent({
      body: { action: 'delete', ids: ['orphan-owned'], reason: 'cleanup' },
    })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['orphan-owned'])
    expect(res.data.failed).toEqual([])
  })

  it('forbids managers from bulk actions', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'archive', ids: ['a'] } }))))
    expect(err.statusCode).toBe(403)
  })

  it('rejects empty ids with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/bulk.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'archive', ids: [] } }))))
    expect(err.statusCode).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// POST /api/tenants/bulk-create
// ---------------------------------------------------------------------------

describe('POST /api/tenants/bulk-create', () => {
  it('creates valid rows and reports validation errors per line', async () => {
    asAdmin()
    repoMocks.insert.mockImplementation((_event: unknown, input: { full_name: string; phone: string }) =>
      Promise.resolve(buildTenant({
        id: `new-${input.full_name}`,
        fullName: input.full_name,
        phone: input.phone,
      })),
    )
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')

    const res = await handler(makeEvent({
      body: {
        rows: [
          { line: 2, full_name: 'Nguyen Van A', phone: '0901234567' },
          { line: 3, full_name: '', phone: '' },
        ],
      },
    })) as {
      data: {
        created: Tenant[]
        failed: Array<{ line: number; reason: string; fieldErrors?: Record<string, string[]> }>
      }
      meta: { created: number; failed: number }
    }

    expect(res.data.created).toHaveLength(1)
    expect(res.data.failed).toHaveLength(1)
    expect(res.data.failed[0]).toMatchObject({ line: 3, reason: 'validation_error' })
    expect(res.meta).toMatchObject({ created: 1, failed: 1 })
  })

  it('flags duplicate id_number inside the same import file', async () => {
    asAdmin()
    repoMocks.insert.mockResolvedValue(buildTenant({ id: 'new-1' }))
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')

    const res = await handler(makeEvent({
      body: {
        rows: [
          { line: 2, full_name: 'Nguyen Van A', phone: '0901234567', id_number: '012345678901' },
          { line: 3, full_name: 'Tran Thi B', phone: '0901111222', id_number: '012345678901' },
        ],
      },
    })) as {
      data: {
        created: Tenant[]
        failed: Array<{ line: number; reason: string }>
      }
    }

    expect(res.data.created).toHaveLength(1)
    expect(res.data.failed).toEqual([{ line: 3, reason: 'duplicate_in_file', message: 'Số CMND/CCCD bị trùng trong file nhập', fieldErrors: { id_number: ['Số CMND/CCCD bị trùng trong file nhập'] } }])
  })

  it('flags duplicate phone inside the same import file and blocks only later row', async () => {
    asAdmin()
    repoMocks.insert.mockResolvedValue(buildTenant({ id: 'new-1' }))
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')

    const res = await handler(makeEvent({
      body: {
        rows: [
          { line: 2, full_name: 'Nguyen Van A', phone: '0901234567' },
          { line: 3, full_name: 'Tran Thi B', phone: '0901234567' },
        ],
      },
    })) as {
      data: {
        created: Tenant[]
        failed: Array<{ line: number; reason: string }>
      }
    }

    expect(res.data.created).toHaveLength(1)
    expect(res.data.failed).toEqual([{ line: 3, reason: 'duplicate_phone_in_file', message: 'Số điện thoại bị trùng trong file nhập', fieldErrors: { phone: ['Số điện thoại bị trùng trong file nhập'] } }])
  })

  it('flags phone already existing in system during bulk import', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'phone', value: '0901234567' }])
    repoMocks.insert.mockResolvedValue(buildTenant({ id: 'new-2' }))
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')

    const res = await handler(makeEvent({
      body: {
        rows: [
          { line: 2, full_name: 'Nguyen Van A', phone: '0901234567' },
          { line: 3, full_name: 'Tran Thi B', phone: '0901111222' },
        ],
      },
    })) as {
      data: {
        created: Tenant[]
        failed: Array<{ line: number; reason: string }>
      }
    }

    expect(res.data.created).toHaveLength(1)
    expect(res.data.failed).toEqual([{ line: 2, reason: 'duplicate_phone', message: 'Số điện thoại đã tồn tại trong hệ thống', fieldErrors: { phone: ['Số điện thoại đã tồn tại trong hệ thống'] } }])
  })

  it('forbids managers from bulk-create', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      body: { rows: [{ line: 2, full_name: 'Nguyen Van A', phone: '0901234567' }] },
    }))))
    expect(err.statusCode).toBe(403)
  })

  it('rejects empty rows payload with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { rows: [] } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('tenant scope regressions', () => {
  it('does not include creator tenants once they have contract history elsewhere', async () => {
    asOwner()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    repoMocks.findCreatedTenantIdsByActor.mockResolvedValue(['orphan', 'transferred'])
    repoMocks.findAccessFacts.mockResolvedValue(new Map([
      ['orphan', { activeBuildingIds: [], historicalBuildingIds: [], everContracted: false }],
      ['transferred', { activeBuildingIds: ['elsewhere'], historicalBuildingIds: ['elsewhere'], everContracted: true }],
    ]))
    const { default: handler } = await import('../../server/api/tenants/index.get')
    await handler(makeEvent())
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ include_ids: ['orphan'], active_scope_only: true }))
  })
  it('preserves manager deletion grant with canonical server building and ignores supplied building', async () => {
    asManager()
    const buildingId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant())
    repoMocks.findAccessFacts.mockResolvedValue(new Map([['t-1', { activeBuildingIds: [buildingId], historicalBuildingIds: [buildingId], everContracted: true }]]))
    assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue({ can_delete_master_data: true })
    repoMocks.countActiveContractsForTenant.mockResolvedValue(0)
    repoMocks.countActiveOccupanciesForTenant.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/tenants/[id].delete')
    const event = makeEvent({ params: { id: 'CODE' }, body: { reason: 'cleanup', building_id: '11111111-1111-4111-8111-111111111111' } })
    await handler(event)
    expect(event.context.statusCode).toBe(204)
    expect(assignmentRepoMocks.findByUserAndBuilding).toHaveBeenCalledWith(expect.anything(), 'user-manager', buildingId)
    expect(repoMocks.remove).toHaveBeenCalledWith(expect.anything(), 't-1')
  })
})

describe('tenant identity hardening regressions', () => {
  it('returns TENANT_DUPLICATE for an admin when the normalized id number exists', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'id_number', value: '012345678901' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({
      body: { full_name: 'Khách Giả Lập', phone: '0901234567', id_number: '0123 4567 8901' },
    }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idNumbers: ['012345678901'] }))
    expect(repoMocks.insert).not.toHaveBeenCalled()
  })

  it('looks up the normalized phone when the input uses +84 and separators', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'phone', value: '0901234567' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Khách Giả Lập', phone: '+84 90 123 4567' } }))))
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phones: ['0901234567'] }))
  })

  it('returns the generic conflict to an owner when the duplicate is outside scope', async () => {
    asOwner()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'other-building', field: 'phone', value: '0901234567' }])
    repoMocks.findAccessFacts.mockResolvedValue(new Map([['other-building', { activeBuildingIds: ['b-other'], historicalBuildingIds: ['b-other'], everContracted: true }]]))
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Khách Giả Lập', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_IDENTITY_CONFLICT')
    expect(err.data?.error?.details).toBeUndefined()
  })

  it('maps a unique-index race on insert to a conflict instead of 500', async () => {
    asAdmin()
    const { TenantIdentityUniqueViolation } = await import('../../server/repositories/tenants/identity-errors')
    repoMocks.insert.mockRejectedValue(new TenantIdentityUniqueViolation('phone'))
    repoMocks.findIdentityMatches.mockResolvedValueOnce([]).mockResolvedValueOnce([{ tenantId: 'racer', field: 'phone', value: '0901234567' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Khách Giả Lập', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
  })

  it('rejects with 429 before lookup when the conflict limit is exhausted', async () => {
    asAdmin()
    limitMocks.peek.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Khách Giả Lập', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(429)
    expect(repoMocks.findIdentityMatches).not.toHaveBeenCalled()
    expect(repoMocks.insert).not.toHaveBeenCalled()
  })
  it('excludes the tenant being edited from identity matching', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-1', phone: '0901234567' }))
    repoMocks.update.mockResolvedValue(buildTenant({ id: 't-1' }))
    const { default: handler } = await import('../../server/api/tenants/[id].patch')
    await handler(makeEvent({ params: { id: 't-1' }, body: { phone: '0901234567' } }))
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ excludeId: 't-1', phones: ['0901234567'] }))
  })
  it('reports out-of-scope duplicates as identity_conflict without detail', async () => {
    asOwner()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'elsewhere', field: 'id_number', value: '012345678901' }])
    repoMocks.findAccessFacts.mockResolvedValue(new Map([['elsewhere', { activeBuildingIds: ['b-other'], historicalBuildingIds: ['b-other'], everContracted: true }]]))
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')
    const res = await handler(makeEvent({ body: { rows: [{ line: 2, full_name: 'Khách Giả Lập', phone: '0901234567', id_number: '012345678901' }] } })) as { data: { failed: unknown[] } }
    expect(res.data.failed).toEqual([{ line: 2, reason: 'identity_conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' }])
    expect(limitMocks.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ units: 1 }))
  })

})

describe('tenant identity write and audit boundaries', () => {
  it('maps an update race to a generic conflict when the racing row disappears', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant())
    const { TenantIdentityUniqueViolation } = await import('../../server/repositories/tenants/identity-errors')
    repoMocks.update.mockRejectedValueOnce(new TenantIdentityUniqueViolation('phone'))
    const { default: handler } = await import('../../server/api/tenants/[id].patch')
    const error = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 't-1' }, body: { phone: '0901234567' } }))))
    expect(error).toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
    expect(error.data?.error?.details).toBeUndefined()
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledTimes(2)
  })

  it('counts database duplicate rows once each while keeping mixed access details generic', async () => {
    asOwner()
    repoMocks.findIdentityMatches.mockResolvedValue([
      { tenantId: 'full', field: 'phone', value: '0900000001' },
      { tenantId: 'foreign', field: 'id_number', value: 'FAKE001' },
      { tenantId: 'full', field: 'phone', value: '0900000002' },
    ])
    repoMocks.findByIds.mockResolvedValue([buildTenant({ id: 'full' }), buildTenant({ id: 'foreign' })])
    repoMocks.findAccessFacts.mockResolvedValue(new Map([
      ['full', { activeBuildingIds: ['0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'], historicalBuildingIds: [], everContracted: true }],
      ['foreign', { activeBuildingIds: ['other'], historicalBuildingIds: ['other'], everContracted: true }],
    ]))
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')
    const result = await handler(makeEvent({ body: { rows: [
      { line: 2, full_name: 'Fixture One', phone: '0900000001', id_number: 'FAKE001' },
      { line: 3, full_name: 'Fixture Two', phone: '0900000002' },
    ] } })) as { data: { failed: unknown[] } }
    expect(result.data.failed).toEqual([
      { line: 2, reason: 'identity_conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' },
      expect.objectContaining({ line: 3, reason: 'duplicate_phone' }),
    ])
    expect(limitMocks.record).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.objectContaining({ units: 2 }))
    expect(repoMocks.insertMany).not.toHaveBeenCalled()
  })

  it('passes a redacted snapshot to audit while returning the full authorized tenant', async () => {
    asAdmin()
    repoMocks.insert.mockResolvedValue(buildTenant({ idNumber: 'FAKE123456789', permanentAddress: 'Private fixture address' }))
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const result = await handler(makeEvent({ body: { full_name: 'Fixture Tenant', phone: '0901234567' } })) as { data: Tenant }
    expect(result.data.idNumber).toBe('FAKE123456789')
    expect(auditMocks.append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ after_data: expect.objectContaining({ idNumber: '•••• 6789', permanentAddress: '[đã ẩn]' }) }))
    expect(JSON.stringify(auditMocks.append.mock.calls)).not.toContain('FAKE123456789')
    expect(JSON.stringify(auditMocks.append.mock.calls)).not.toContain('Private fixture address')
  })
})
