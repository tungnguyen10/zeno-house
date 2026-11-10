import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ db: vi.fn(), from: vi.fn() }))

vi.mock('../../../server/utils/db', () => ({ db: mocks.db }))

const row = {
  id: 'request-1',
  tenant_id: 'tenant-1',
  building_id: 'building-1',
  contract_id: 'contract-1',
  title: 'Leaking tap',
  description: 'Water is leaking.',
  status: 'new',
  attachment_path: null,
  created_at: '2026-07-17T10:00:00.000Z',
  updated_at: '2026-07-17T10:00:00.000Z',
}

function chain(terminal: Record<string, unknown> = {}) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'lte', 'gte', 'order', 'limit', 'in', 'insert']) {
    query[method] = vi.fn(() => query)
  }
  Object.assign(query, terminal)
  return query
}

describe('TenantSupportRequestRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.db.mockReturnValue({ from: mocks.from })
  })

  it('lists the resolved tenant timeline newest first', async () => {
    const query = chain()
    query.order.mockResolvedValue({ data: [row], error: null })
    mocks.from.mockReturnValue(query)
    const { TenantSupportRequestRepository } = await import(
      '../../../server/repositories/tenant-portal/requests'
    )

    await expect(TenantSupportRequestRepository.listByTenantId(
      {} as never,
      'tenant-1',
    )).resolves.toEqual([row])
    expect(mocks.from).toHaveBeenCalledWith('support_requests')
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('creates a new request and returns the stored row', async () => {
    const query = chain({ single: vi.fn().mockResolvedValue({ data: row, error: null }) })
    mocks.from.mockReturnValue(query)
    const { TenantSupportRequestRepository } = await import(
      '../../../server/repositories/tenant-portal/requests'
    )
    const input = {
      tenant_id: 'tenant-1',
      building_id: 'building-1',
      contract_id: 'contract-1',
      title: 'Leaking tap',
      description: 'Water is leaking.',
      attachment_path: null,
    }

    await expect(TenantSupportRequestRepository.create({} as never, input))
      .resolves.toEqual(row)
    expect(query.insert).toHaveBeenCalledWith(input)
  })

  it('filters operator reads by assigned buildings and leaves admin unscoped', async () => {
    const assignedQuery = chain()
    assignedQuery.order.mockResolvedValue({ data: [row], error: null })
    mocks.from.mockReturnValueOnce(assignedQuery)
    const { TenantSupportRequestRepository } = await import(
      '../../../server/repositories/tenant-portal/requests'
    )

    await TenantSupportRequestRepository.listByBuildingIds({} as never, ['building-1'])
    expect(assignedQuery.in).toHaveBeenCalledWith('building_id', ['building-1'])

    const adminQuery = chain()
    adminQuery.order.mockResolvedValue({ data: [row], error: null })
    mocks.from.mockReturnValueOnce(adminQuery)
    await TenantSupportRequestRepository.listByBuildingIds({} as never, null)
    expect(adminQuery.in).not.toHaveBeenCalled()
  })

  it('does not query when an operator has no assigned buildings', async () => {
    const { TenantSupportRequestRepository } = await import(
      '../../../server/repositories/tenant-portal/requests'
    )

    await expect(TenantSupportRequestRepository.listByBuildingIds({} as never, []))
      .resolves.toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('operator request repository boundaries', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.db.mockReturnValue({ from: mocks.from }) })
  it('scans only lean metadata in deterministic order before private detail reads', async () => {
    const query = chain({ range: vi.fn().mockResolvedValue({ data: [row], error: null }) })
    mocks.from.mockReturnValue(query)
    const { TenantSupportRequestRepository: repo } = await import('../../../server/repositories/tenant-portal/requests')
    await repo.listOperatorCandidates({} as never, ['building-1'], 'new')
    expect(query.select).toHaveBeenCalledWith('id, tenant_id, building_id, contract_id, status, created_at')
    expect(query.in).toHaveBeenCalledWith('building_id', ['building-1'])
    expect(query.eq).toHaveBeenCalledWith('status', 'new')
    expect(query.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]])
  })
  it('does not query private descriptions for an empty authorized page', async () => {
    const { TenantSupportRequestRepository: repo } = await import('../../../server/repositories/tenant-portal/requests')
    expect(await repo.findByIds({} as never, [])).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each([
    ['SUPPORT_REQUEST_STATUS_STALE', 409],
    ['SUPPORT_REQUEST_NOT_FOUND', 404],
    ['SUPPORT_REQUEST_STATUS_TRANSITION_INVALID', 422],
  ])('maps %s without leaking database context', async (message, statusCode) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message, code: 'P0001' } })
    mocks.db.mockReturnValue({ rpc })
    const { TenantSupportRequestRepository: repo } = await import('../../../server/repositories/tenant-portal/requests')
    await expect(repo.updateStatusWithAudit({} as never, 'request-1', { status: 'resolved', expected_status: 'in_progress' }, 'actor')).rejects.toMatchObject({ statusCode })
    expect(rpc).toHaveBeenCalledWith('update_tenant_support_request_status_with_audit', { p_request_id: 'request-1', p_expected_status: 'in_progress', p_status: 'resolved', p_actor_id: 'actor' })
  })
})
