import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { ContractStatus, ContractWithDetails } from '../../app/types/contracts'

const contractRepoMocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByIdentifier: vi.fn(),
  findById: vi.fn(),
  findActiveByRoomId: vi.fn(),
  findActiveByTenantId: vi.fn(),
  createWithHandover: vi.fn(),
  update: vi.fn(),
  removeWithCascade: vi.fn(),
  countBillingPeriodsForContract: vi.fn(),
  countPaidInvoicesForContract: vi.fn(),
  countNonHandoverMeterReadingsForContract: vi.fn(),
}))

const buildingRepoMocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
}))

const roomRepoMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdentifier: vi.fn(),
  update: vi.fn(),
}))

const tenantRepoMocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
}))

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
  findByUserAndBuilding: vi.fn(),
}))

const occupantRepoMocks = vi.hoisted(() => ({
  findActiveOccupancyByTenant: vi.fn(),
}))

const contractServicesMocks = vi.hoisted(() => ({
  cloneFromBuilding: vi.fn(),
}))

vi.mock('../../server/repositories/contracts', () => ({
  ContractRepository: contractRepoMocks,
}))

vi.mock('../../server/repositories/buildings', () => ({
  BuildingRepository: buildingRepoMocks,
}))

vi.mock('../../server/repositories/rooms', () => ({
  RoomRepository: roomRepoMocks,
}))

vi.mock('../../server/repositories/tenants', () => ({
  TenantRepository: tenantRepoMocks,
}))

vi.mock('../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

vi.mock('../../server/repositories/contract-occupants', () => ({
  ContractOccupantRepository: occupantRepoMocks,
}))

vi.mock('../../server/services/contract-services', () => ({
  ContractServiceService: contractServicesMocks,
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
  admin: new Set(['contracts.read', 'contracts.create', 'contracts.update', 'contracts.delete']),
  manager: new Set(['contracts.read']),
}
vi.stubGlobal('can', (user: { app_metadata?: { role?: string } }, capability: string) => {
  const role = user?.app_metadata?.role ?? 'admin'
  return CAPS[role]?.has(capability) ?? false
})

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

interface ApiError {
  statusCode?: number
  data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } }
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

function buildContract(overrides: Partial<ContractWithDetails> = {}): ContractWithDetails {
  const status = overrides.status ?? 'active'
  return {
    id: overrides.id ?? 'contract-1',
    contractCode: overrides.contractCode ?? 'hd-2026-0001',
    roomId: overrides.roomId ?? 'room-1',
    tenantId: overrides.tenantId ?? 'tenant-1',
    buildingId: overrides.buildingId ?? 'building-1',
    startDate: overrides.startDate ?? '2026-06-01',
    endDate: overrides.endDate ?? '2027-06-01',
    monthlyRent: overrides.monthlyRent ?? 3_000_000,
    deposit: overrides.deposit ?? 3_000_000,
    paymentDay: overrides.paymentDay ?? 5,
    occupantCount: overrides.occupantCount ?? 2,
    discountAmount: overrides.discountAmount ?? 0,
    surchargeAmount: overrides.surchargeAmount ?? 0,
    previousContractId: overrides.previousContractId ?? null,
    originalEndDate: overrides.originalEndDate ?? null,
    renewalCount: overrides.renewalCount ?? 0,
    status: status as ContractStatus,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2026-06-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-01T00:00:00.000Z',
    room: overrides.room ?? {
      id: 'room-1',
      code: 'a-101',
      roomNumber: 'A101',
      floor: 1,
      buildingId: 'building-1',
      buildingName: 'Toa A',
    },
    tenant: overrides.tenant ?? {
      id: 'tenant-1',
      code: 'tenant-1',
      fullName: 'Nguyen Van A',
      phone: '0901000001',
    },
  }
}

const validCreateBody = {
  room_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b811111',
  tenant_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b822222',
  building_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333',
  start_date: '2026-06-01',
  end_date: '2027-06-01',
  monthly_rent: 3_000_000,
  deposit: 3_000_000,
  payment_day: 5,
  occupant_count: 2,
  discount_amount: 0,
  surcharge_amount: 0,
  status: 'active',
  notes: null,
  handover_electricity_reading: 1200,
  handover_water_reading: 80,
  handover_reading_date: '2026-06-01',
}

beforeEach(() => {
  vi.clearAllMocks()
  asAdmin()
  buildingRepoMocks.findByIdentifier.mockResolvedValue({ id: 'building-1' })
  roomRepoMocks.findByIdentifier.mockResolvedValue({ id: 'room-1' })
  tenantRepoMocks.findByIdentifier.mockResolvedValue({ id: 'tenant-1' })
  roomRepoMocks.findById.mockResolvedValue({
    id: validCreateBody.room_id,
    roomNumber: 'A101',
    status: 'available',
    buildingId: validCreateBody.building_id,
    monthlyRent: 3_000_000,
  })
  contractRepoMocks.findActiveByRoomId.mockResolvedValue(null)
  contractRepoMocks.findActiveByTenantId.mockResolvedValue(null)
  occupantRepoMocks.findActiveOccupancyByTenant.mockResolvedValue(null)
  contractRepoMocks.countBillingPeriodsForContract.mockResolvedValue(0)
  contractRepoMocks.countPaidInvoicesForContract.mockResolvedValue(0)
  contractRepoMocks.countNonHandoverMeterReadingsForContract.mockResolvedValue(0)
  assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
  assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue(null)
})

describe('GET /api/contracts', () => {
  it('returns pagination defaults and forwards search/status/sort filters', async () => {
    contractRepoMocks.findAll.mockResolvedValue({ items: [buildContract()], total: 1 })
    const { default: handler } = await import('../../server/api/contracts/index.get')

    const res = await handler(makeEvent({
      query: {
        q: 'nguyen',
        status: ['active', 'expired'],
        sort: 'monthly_rent',
        order: 'asc',
      },
    })) as { data: ContractWithDetails[]; meta: { page: number; limit: number; total: number } }

    expect(contractRepoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      page: 1,
      limit: 20,
      q: 'nguyen',
      status: ['active', 'expired'],
      sort: 'monthly_rent',
      order: 'asc',
    }))
    expect(res.data).toHaveLength(1)
    expect(res.meta).toMatchObject({ page: 1, limit: 20, total: 1 })
  })

  it('rejects invalid sort with 422', async () => {
    const { default: handler } = await import('../../server/api/contracts/index.get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ query: { sort: 'secret' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })

  it('passes manager assigned building ids into contract list filters', async () => {
    asManager()
    contractRepoMocks.findAll.mockResolvedValue({ items: [buildContract({ buildingId: 'building-1' })], total: 1 })
    const { default: handler } = await import('../../server/api/contracts/index.get')

    await handler(makeEvent({ query: {} }))
    expect(contractRepoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingIds: ['building-1'],
    }))
  })
})

describe('POST /api/contracts', () => {
  it('creates a contract with handover and returns 201', async () => {
    contractRepoMocks.createWithHandover.mockResolvedValue(buildContract({ id: 'new-contract' }))
    const { default: handler } = await import('../../server/api/contracts/index.post')

    const event = makeEvent({ body: validCreateBody })
    const res = await handler(event) as { data: ContractWithDetails }

    expect(contractRepoMocks.createWithHandover).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        room_id: validCreateBody.room_id,
        tenant_id: validCreateBody.tenant_id,
        handover_electricity_reading: 1200,
        handover_water_reading: 80,
      }),
      'user-admin',
    )
    expect(res.data.id).toBe('new-contract')
    expect(event.context.statusCode).toBe(201)
  })

  it('returns 422 for invalid body, 409 for occupied room, and 403 for manager', async () => {
    const { default: handler } = await import('../../server/api/contracts/index.post')

    const invalid = await expectError(Promise.resolve(handler(makeEvent({ body: { room_id: 'bad' } }))))
    expect(invalid.statusCode).toBe(422)

    contractRepoMocks.findActiveByRoomId.mockResolvedValue(buildContract())
    const conflict = await expectError(Promise.resolve(handler(makeEvent({ body: validCreateBody }))))
    expect(conflict.statusCode).toBe(409)

    contractRepoMocks.findActiveByRoomId.mockResolvedValue(null)
    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ body: validCreateBody }))))
    expect(forbidden.statusCode).toBe(403)
  })

  it('returns 403 when manager creates a contract for an unassigned room', async () => {
    CAPS.manager.add('contracts.create')
    try {
      asManager()
      assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['other-building'])
      roomRepoMocks.findById.mockResolvedValue({
        id: validCreateBody.room_id,
        roomNumber: 'A101',
        status: 'available',
        buildingId: validCreateBody.building_id,
        monthlyRent: 3_000_000,
      })
      const { default: handler } = await import('../../server/api/contracts/index.post')

      const err = await expectError(Promise.resolve(handler(makeEvent({ body: validCreateBody }))))
      expect(err.statusCode).toBe(403)
      expect(contractRepoMocks.createWithHandover).not.toHaveBeenCalled()
    }
    finally {
      CAPS.manager.delete('contracts.create')
    }
  })
})

describe('GET /api/contracts/[id]', () => {
  it('returns contract by id or code', async () => {
    contractRepoMocks.findByIdentifier.mockResolvedValue(buildContract({ contractCode: 'hd-2026-0001' }))
    const { default: handler } = await import('../../server/api/contracts/[id].get')

    const res = await handler(makeEvent({ params: { id: 'hd-2026-0001' } })) as { data: ContractWithDetails }
    expect(res.data.contractCode).toBe('hd-2026-0001')
    expect(contractRepoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'hd-2026-0001')
  })

  it('returns 404 when missing', async () => {
    contractRepoMocks.findByIdentifier.mockResolvedValue(null)
    const { default: handler } = await import('../../server/api/contracts/[id].get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'missing' } }))))
    expect(err.statusCode).toBe(404)
  })

  it('returns 404 when manager reads contract outside assigned scope', async () => {
    asManager()
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['other-building'])
    contractRepoMocks.findByIdentifier.mockResolvedValue(buildContract({ buildingId: 'building-1' }))
    const { default: handler } = await import('../../server/api/contracts/[id].get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'contract-1' } }))))
    expect(err.statusCode).toBe(404)
  })
})

describe('PATCH /api/contracts/[id]', () => {
  it('updates status transitions', async () => {
    const existing = buildContract({ status: 'active' })
    contractRepoMocks.findByIdentifier.mockResolvedValue(existing)
    contractRepoMocks.update.mockResolvedValue(buildContract({ status: 'terminated' }))
    const { default: handler } = await import('../../server/api/contracts/[id].patch')

    const res = await handler(makeEvent({ params: { id: 'contract-1' }, body: { status: 'terminated' } })) as { data: ContractWithDetails }
    expect(res.data.status).toBe('terminated')
    expect(roomRepoMocks.update).toHaveBeenCalledWith(expect.anything(), existing.roomId, { status: 'available' })
  })

  it('rejects invalid transition payload and forbids manager', async () => {
    const { default: handler } = await import('../../server/api/contracts/[id].patch')

    const invalid = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'contract-1' }, body: { status: 'renewed' } }))))
    expect(invalid.statusCode).toBe(422)

    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'contract-1' }, body: { notes: 'x' } }))))
    expect(forbidden.statusCode).toBe(403)
  })
})

describe('DELETE /api/contracts/[id]', () => {
  it.each([
    ['active contract', buildContract({ status: 'active' }), [0, 0, 0], { reason: 'ACTIVE_CONTRACT' }],
    ['issued billing periods', buildContract({ status: 'terminated' }), [2, 0, 0], { issuedBillingPeriods: 2 }],
    ['paid invoices', buildContract({ status: 'terminated' }), [0, 1, 0], { paidPayments: 1 }],
    ['non-handover meter readings', buildContract({ status: 'terminated' }), [0, 0, 3], { nonHandoverMeterReadings: 3 }],
    ['multiple violations', buildContract({ status: 'active' }), [2, 1, 3], {
      reason: 'ACTIVE_CONTRACT',
      issuedBillingPeriods: 2,
      paidPayments: 1,
      nonHandoverMeterReadings: 3,
    }],
  ])('returns 409 for %s', async (_label, contract, counts, details) => {
    contractRepoMocks.findByIdentifier.mockResolvedValue(contract)
    contractRepoMocks.countBillingPeriodsForContract.mockResolvedValue(counts[0])
    contractRepoMocks.countPaidInvoicesForContract.mockResolvedValue(counts[1])
    contractRepoMocks.countNonHandoverMeterReadingsForContract.mockResolvedValue(counts[2])
    const { default: handler } = await import('../../server/api/contracts/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: contract.id }, body: { reason: 'cleanup' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('CONFLICT')
    expect(err.data?.error?.details).toEqual(details)
  })

  it('hard deletes clean terminated contract with 204', async () => {
    const contract = buildContract({ status: 'terminated' })
    contractRepoMocks.findByIdentifier.mockResolvedValue(contract)
    const { default: handler } = await import('../../server/api/contracts/[id].delete')

    const event = makeEvent({ params: { id: contract.id }, body: { reason: 'cleanup' } })
    await handler(event)

    expect(contractRepoMocks.removeWithCascade).toHaveBeenCalledWith(expect.anything(), contract)
    expect(event.context.statusCode).toBe(204)
  })

  it('force=true terminates active contract then deletes when clean, but still blocks billing and managers', async () => {
    const active = buildContract({ status: 'active' })
    const terminated = buildContract({ status: 'terminated' })
    contractRepoMocks.findByIdentifier.mockResolvedValue(active)
    contractRepoMocks.update.mockResolvedValue(terminated)
    const { default: handler } = await import('../../server/api/contracts/[id].delete')

    const res = await handler(makeEvent({ params: { id: active.id }, query: { force: 'true' }, body: { reason: 'cleanup' } })) as { data: ContractWithDetails }
    expect(contractRepoMocks.update).toHaveBeenCalledWith(expect.anything(), active.id, { status: 'terminated' })
    expect(contractRepoMocks.removeWithCascade).toHaveBeenCalledWith(expect.anything(), terminated)
    expect(res.data.status).toBe('terminated')

    contractRepoMocks.removeWithCascade.mockClear()
    contractRepoMocks.countBillingPeriodsForContract.mockResolvedValue(1)
    const conflict = await expectError(Promise.resolve(handler(makeEvent({ params: { id: active.id }, query: { force: 'true' }, body: { reason: 'cleanup' } }))))
    expect(conflict.statusCode).toBe(409)
    expect(conflict.data?.error?.details).toEqual({ issuedBillingPeriods: 1 })
    expect(contractRepoMocks.removeWithCascade).not.toHaveBeenCalled()

    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ params: { id: active.id }, query: { force: 'true' }, body: { reason: 'cleanup' } }))))
    expect(forbidden.statusCode).toBe(403)
  })

  it('requires a delete reason', async () => {
    const { default: handler } = await import('../../server/api/contracts/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'contract-1' }, body: {} }))))
    expect(err.statusCode).toBe(422)
  })
})

describe('POST /api/contracts/bulk', () => {
  it('terminates selected contracts', async () => {
    contractRepoMocks.findByIdentifier.mockResolvedValue(buildContract({ status: 'active' }))
    contractRepoMocks.update.mockResolvedValue(buildContract({ status: 'terminated' }))
    const { default: handler } = await import('../../server/api/contracts/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'terminate', ids: ['a', 'b'], reason: 'done' } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }

    expect(res.data).toEqual({ succeeded: ['a', 'b'], failed: [] })
    expect(contractRepoMocks.update).toHaveBeenCalledTimes(2)
  })

  it('returns mixed delete results with normalized reasons', async () => {
    contractRepoMocks.findByIdentifier.mockImplementation(async (_event, id: string) => {
      if (id === 'missing') return null
      return buildContract({ id, status: id === 'active' ? 'active' : 'terminated' })
    })
    contractRepoMocks.countBillingPeriodsForContract.mockImplementation(async (_event, id: string) => id === 'with-billing' ? 1 : 0)
    contractRepoMocks.countPaidInvoicesForContract.mockResolvedValue(0)
    contractRepoMocks.countNonHandoverMeterReadingsForContract.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/contracts/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'delete', ids: ['empty', 'with-billing', 'active', 'missing'], reason: 'cleanup' } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }

    expect(res.data.succeeded).toEqual(['empty'])
    expect(res.data.failed).toEqual([
      { id: 'with-billing', reason: 'has_billing_history' },
      { id: 'active', reason: 'ACTIVE_CONTRACT' },
      { id: 'missing', reason: 'not_found' },
    ])
  })

  it('forbids manager and rejects empty ids or invalid action', async () => {
    const { default: handler } = await import('../../server/api/contracts/bulk.post')

    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'terminate', ids: ['contract-1'] } }))))
    expect(forbidden.statusCode).toBe(403)

    asAdmin()
    const empty = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'terminate', ids: [] } }))))
    expect(empty.statusCode).toBe(422)

    const invalidAction = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'renew', ids: ['contract-1'] } }))))
    expect(invalidAction.statusCode).toBe(422)
  })
})
