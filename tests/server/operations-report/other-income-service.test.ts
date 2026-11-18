import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { buildingOtherIncomeCreateSchema } from '~/utils/validators/operations-report'
import { can } from '../../../server/utils/permissions'

const { rpc, from, assertBuildingScope, invalidateOperationsReport, findBuilding } = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), assertBuildingScope: vi.fn(), invalidateOperationsReport: vi.fn(), findBuilding: vi.fn(),
}))
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc, from }) }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/operations-report/cache', () => ({ invalidateOperationsReport }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findById: findBuilding } }))

const event = {} as H3Event
const owner = { id: 'owner', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager', app_metadata: { role: 'manager' } } as AuthUser
const tenant = { id: 'tenant', app_metadata: { role: 'tenant' } } as AuthUser
const buildingId = '8a1efdab-74cc-4c82-b3cb-c56e37382ed3'
const row = {
  id: '715dcbee-a779-4409-8465-eb1d0c6f19b6', building_id: buildingId,
  period_year: 2026, period_month: 11, name: 'Thanh lý', amount: '150000',
  received_date: '2026-11-06', allocation_target: 'reserve_fund', payer: null,
  payment_method: null, transaction_reference: null, note: null,
  created_by: 'owner', created_at: '2026-11-06T06:07:00Z', updated_at: '2026-11-06T06:07:00Z',
  voided_at: null, voided_by: null, void_reason: null,
}
const input = buildingOtherIncomeCreateSchema.parse({
  building_id: buildingId, period_year: 2026, period_month: 11, name: row.name,
  operation_id: 'eab7f3d0-57ec-47cc-a05a-9f6da429652a',
  received_date: row.received_date, amount: Number(row.amount),
})
const version = { expected_updated_at: row.updated_at }
const query = { building_id: buildingId, period_year: 2026, period_month: 11 }

describe('building other income services and atomic RPC boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('can', can)
    findBuilding.mockResolvedValue({ id: buildingId })
    rpc.mockResolvedValue({ data: row, error: null })
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    })
  })
  const load = async () => (await import('../../../server/services/operations-report/other-incomes')).BuildingOtherIncomeService

  it('uses the same operation id on retry and invalidates the report after success', async () => {
    const service = await load()
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(service.create(event, owner, input)).resolves.toMatchObject({
        id: row.id, amount: 150000, allocationTarget: 'reserve_fund', updatedAt: row.updated_at,
      })
    }
    expect(rpc.mock.calls[0]).toEqual(['mutate_building_other_income', {
      p_action: 'create', p_actor_id: owner.id, p_income_id: null, p_payload: input,
    }])
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
    expect(invalidateOperationsReport).toHaveBeenCalledWith(buildingId)
  })

  it('checks the create, update, and void rights of a profit-only writer', async () => {
    const service = await load()
    await expect(service.create(event, manager, input)).rejects.toMatchObject({ statusCode: 403 })
    await service.create(event, manager, { ...input, allocation_target: 'profit' })
    await expect(service.update(event, manager, row.id, { ...version, allocation_target: 'profit' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(service.update(event, manager, row.id, { ...version, note: 'Ghi chú mới' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(service.void(event, manager, row.id, { ...version, void_reason: 'Sai kỳ' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(service.list(event, tenant, query)).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('enforces building scope for reads, edits and creation', async () => {
    const service = await load()
    assertBuildingScope.mockRejectedValue(new Error('outside scope'))
    await expect(service.list(event, owner, query)).rejects.toThrow('outside scope')
    await expect(service.create(event, owner, input)).rejects.toThrow('outside scope')
    await expect(service.update(event, owner, row.id, { ...version, amount: 100 })).rejects.toThrow('outside scope')
    expect(rpc).not.toHaveBeenCalled()
    expect(assertBuildingScope).toHaveBeenCalledWith(event, owner, buildingId, 'write')
  })

  it('checks edits against the existing immutable period', async () => {
    const service = await load()
    await expect(service.update(event, owner, row.id, { ...version, received_date: '2026-12-01' })).rejects.toMatchObject({ statusCode: 422 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('forwards the original version on edit and void, including duplicate confirmation', async () => {
    const service = await load()
    const edit = { ...version, amount: 5000, confirm_duplicate: true }
    const cancellation = { ...version, void_reason: 'Đã ghi hai lần' }
    await service.update(event, owner, row.id, edit)
    await service.void(event, owner, row.id, cancellation)
    for (const [action, payload] of [['update', edit], ['void', cancellation]]) {
      expect(rpc).toHaveBeenCalledWith('mutate_building_other_income', {
        p_actor_id: owner.id, p_income_id: row.id, p_action: action, p_payload: payload,
      })
    }
  })

  it.each([
    ['OTHER_INCOME_DUPLICATE', 409], ['OTHER_INCOME_PERIOD_CLOSED', 409], ['OTHER_INCOME_STALE', 409],
    ['OTHER_INCOME_OPERATION_CONFLICT', 409], ['OTHER_INCOME_VOIDED', 409],
    ['OTHER_INCOME_NOT_FOUND', 404], ['OTHER_INCOME_FORBIDDEN', 403], ['OTHER_INCOME_INVALID', 422],
    ['unexpected failure writing audit row', 500],
  ])('maps database guard %s without leaking private billing details', async (message, statusCode) => {
    const service = await load()
    rpc.mockResolvedValue({ data: null, error: { message, details: 'private billing details' } })
    const failure = service.create(event, owner, input)
    await expect(failure).rejects.toMatchObject({ statusCode })
    if (statusCode === 409) {
      await expect(failure).rejects.toMatchObject({ data: { error: { details: { reason: message } } } })
    }
    await expect(failure).rejects.not.toThrow('private billing details')
    expect(invalidateOperationsReport).not.toHaveBeenCalled()
  })
})
