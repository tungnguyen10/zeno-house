import { beforeEach, expect, it, vi } from 'vitest'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
const repo = vi.hoisted(() => ({ findTenantIdsForBuildings: vi.fn(), findAll: vi.fn(), findByIds: vi.fn(), findByIdentifier: vi.fn(), findAccessFacts: vi.fn(), findCreatedTenantIdsByActor: vi.fn(), update: vi.fn(), findActiveAssignmentByTenantId: vi.fn(), findByPhone: vi.fn(), findByIdNumber: vi.fn() }))
const storage = vi.hoisted(() => vi.fn())
const bulk = vi.hoisted(() => ({ execute: vi.fn() }))
const audit = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))
vi.mock('../../../server/repositories/tenants/bulk-status', () => ({ TenantBulkStatusRepository: bulk }))
vi.mock('../../../server/repositories/bulk-actions', () => ({ BulkActionRepository: { resolveSnapshots: vi.fn(async () => new Map()) } }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: repo }))
vi.mock('../../../server/utils/scope', () => ({ getVisibleBuildingIds: vi.fn(async () => ['a']), getAssignedBuildingIds: vi.fn(async () => ['a']), canDeleteMasterData: vi.fn(async () => true) }))
vi.mock('../../../server/utils/db', () => ({ db: storage }))
vi.mock('../../../server/services/audit', () => ({ AuditService: audit }))
const event = { context: {} } as never
const actor = { id: 'owner', app_metadata: { role: 'owner' } } as never
beforeEach(() => {
  vi.clearAllMocks()
  repo.findByIdentifier.mockResolvedValue({ id: 'id', code: 'CODE', fullName: 'Name', phone: '123', status: 'active', idNumber: 'secret', idCardFrontPath: 'private', email: 'secret' })
  repo.findCreatedTenantIdsByActor.mockResolvedValue([])
  repo.findAccessFacts.mockResolvedValue(new Map([['id', { activeBuildingIds: ['b'], historicalBuildingIds: ['a', 'b'], everContracted: true }]]))
})
it('serializes historical basic profile with an exact allowlist and no storage requests', async () => {
  const { TenantService } = await import('../../../server/services/tenants')
  expect(await TenantService.get(event, actor, 'CODE')).toEqual({ id: 'id', code: 'CODE', fullName: 'Name', phone: '123', status: 'active', accessLevel: 'basic' })
  expect(storage).not.toHaveBeenCalled()
  expect(repo.findActiveAssignmentByTenantId).not.toHaveBeenCalled()
})
it.each((['update', 'uploadIdImage', 'removeIdImage', 'remove'] as const).flatMap(method => ([['basic', 403], ['none', 404]] as const).map(([level, status]) => ({ method, level, status }))))('denies $level $method before writes or storage', async ({ method, level, status }) => {
  if (level === 'none') repo.findAccessFacts.mockResolvedValue(new Map([['id', { activeBuildingIds: ['b'], historicalBuildingIds: ['b'], everContracted: true }]]))
  const { TenantService } = await import('../../../server/services/tenants')
  const operation = method === 'update' ? TenantService.update(event, actor, 'CODE', { phone: '999' })
    : method === 'uploadIdImage' ? TenantService.uploadIdImage(event, actor, 'CODE', 'front', { type: 'image/png', data: Buffer.from('png') })
      : method === 'removeIdImage' ? TenantService.removeIdImage(event, actor, 'CODE', 'front')
        : TenantService.remove(event, actor, 'CODE', { reason: 'reason' })
  await expect(operation).rejects.toMatchObject({ statusCode: status })
  expect(repo.update).not.toHaveBeenCalled()
  expect(repo.findByPhone).not.toHaveBeenCalled()
  expect(storage).not.toHaveBeenCalled()
})

it('redacts basic profiles in contract-picker lists too', async () => {
  const tenant = await repo.findByIdentifier()
  repo.findAll.mockResolvedValue({ items: [tenant], total: 1 })
  const { TenantService } = await import('../../../server/services/tenants')
  expect((await TenantService.list(event, actor, { available: true })).items).toEqual([{ id: 'id', code: 'CODE', fullName: 'Name', phone: '123', status: 'active', accessLevel: 'basic' }])
})
it.each(['archive', 'activate'] as const)('deduplicates mixed bulk %s authorization and audits only successful scoped IDs', async (action) => {
  const tenant = await repo.findByIdentifier()
  repo.findByIds.mockResolvedValue(['ok', 'conflict', 'basic', 'foreign'].map(id => ({ ...tenant, id })))
  repo.findAccessFacts.mockResolvedValue(new Map([
    ['ok', { activeBuildingIds: ['a'], historicalBuildingIds: ['a'], everContracted: true }],
    ['conflict', { activeBuildingIds: ['a'], historicalBuildingIds: ['a'], everContracted: true }],
    ['basic', { activeBuildingIds: ['b'], historicalBuildingIds: ['a', 'b'], everContracted: true }],
    ['foreign', { activeBuildingIds: ['b'], historicalBuildingIds: ['b'], everContracted: true }],
  ]))
  bulk.execute.mockResolvedValue([{ id: 'ok', succeeded: true }, { id: 'conflict', succeeded: false, reason: 'conflict' }])
  const { TenantService } = await import('../../../server/services/tenants')
  const result = await TenantService.bulkAction(event, actor, { action, ids: ['ok', 'ok', 'conflict', 'basic', 'foreign', 'missing'], building_id: 'spoof' })
  expect(result).toEqual({ succeeded: ['ok'], failed: [{ id: 'basic', reason: 'forbidden' }, { id: 'foreign', reason: 'not_found' }, { id: 'missing', reason: 'not_found' }, { id: 'conflict', reason: 'conflict' }] })
  expect(bulk.execute).toHaveBeenCalledWith(event, action, [{ id: 'ok', expected_building_ids: ['a'] }, { id: 'conflict', expected_building_ids: ['a'] }])
  expect(audit.appendBulk).toHaveBeenCalledExactlyOnceWith(event, actor, expect.objectContaining({
    aggregate_action: `tenant.bulk_${action}`,
    total: 5,
    failed: 4,
    succeeded: ['ok'],
    items: [expect.objectContaining({
      entity_id: 'ok',
      building_id: 'a',
      action: action === 'archive' ? AUDIT_ACTIONS.TENANT_ARCHIVED : AUDIT_ACTIONS.TENANT_ACTIVATED,
    })],
  }))
  expect(audit.append).not.toHaveBeenCalled()
})

it('preclassifies foreign and basic bulk delete without any persistence calls', async () => {
  const tenant = await repo.findByIdentifier()
  repo.findByIds.mockResolvedValue([{ ...tenant, id: 'basic' }, { ...tenant, id: 'foreign' }])
  repo.findAccessFacts.mockResolvedValue(new Map([
    ['basic', { activeBuildingIds: ['b'], historicalBuildingIds: ['a', 'b'], everContracted: true }],
    ['foreign', { activeBuildingIds: ['b'], historicalBuildingIds: ['b'], everContracted: true }],
  ]))
  repo.findByIdentifier.mockClear()
  const { TenantService } = await import('../../../server/services/tenants')
  expect(await TenantService.bulkAction(event, actor, { action: 'delete', ids: ['basic', 'foreign', 'basic'], reason: 'cleanup', building_id: 'spoof' })).toEqual({ succeeded: [], failed: [{ id: 'basic', reason: 'forbidden' }, { id: 'foreign', reason: 'not_found' }] })
  expect(repo.findByIdentifier).not.toHaveBeenCalled()
  expect(audit.appendBulk).not.toHaveBeenCalled()
  expect(bulk.execute).not.toHaveBeenCalled()
})

it('derives sensitive-search IDs only from full contexts in visible candidates', async () => {
  const tenant = await repo.findByIdentifier()
  repo.findTenantIdsForBuildings.mockResolvedValue(['full', 'basic'])
  repo.findByIds.mockResolvedValue([{ ...tenant, id: 'full' }, { ...tenant, id: 'basic' }])
  repo.findAccessFacts.mockResolvedValue(new Map([
    ['full', { activeBuildingIds: ['a'], historicalBuildingIds: ['a'], everContracted: true }],
    ['basic', { activeBuildingIds: ['b'], historicalBuildingIds: ['a', 'b'], everContracted: true }],
  ]))
  repo.findAll.mockResolvedValue({ items: [], total: 0 })
  const { TenantService } = await import('../../../server/services/tenants')
  await TenantService.list(event, actor, { q: 'secret' })
  expect(repo.findAll).toHaveBeenCalledWith(event, expect.objectContaining({ sensitive_search_ids: ['full'] }))
})
