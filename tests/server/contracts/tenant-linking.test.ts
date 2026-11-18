import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  assertLinkable: vi.fn(),
  findRoomById: vi.fn(),
  findByIdentifier: vi.fn(),
  findById: vi.fn(),
  findActiveByRoomId: vi.fn(),
  findActiveByTenantId: vi.fn(),
  findActiveOccupancyByTenant: vi.fn(),
  findActiveByTenant: vi.fn(),
  listByContract: vi.fn(),
  insertOccupant: vi.fn(),
  createFull: vi.fn(),
  update: vi.fn(),
  updateRoom: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('../../../server/services/tenants/authorization', () => ({ TenantAuthorizationService: { assertLinkable: mocks.assertLinkable } }))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { findById: mocks.findRoomById, update: mocks.updateRoom } }))
vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: {
    findByIdentifier: mocks.findByIdentifier,
    findById: mocks.findById,
    findActiveByRoomId: mocks.findActiveByRoomId,
    findActiveByTenantId: mocks.findActiveByTenantId,
    createFull: mocks.createFull,
    update: mocks.update,
  },
}))
vi.mock('../../../server/repositories/contract-occupants', () => ({
  ContractOccupantRepository: {
    findActiveOccupancyByTenant: mocks.findActiveOccupancyByTenant,
    findActiveByTenant: mocks.findActiveByTenant,
    listByContract: mocks.listByContract,
    insert: mocks.insertOccupant,
  },
}))
vi.mock('../../../server/repositories/inventory', () => ({ InventoryRepository: { listRoom: () => Promise.resolve([]) } }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.audit } }))
vi.mock('../../../server/utils/checkout-feature', () => ({ checkoutEnabledForBuilding: () => false }))

const owner = { id: 'owner-b', app_metadata: { role: 'admin' } } as AuthUser
const event = { context: {} } as never
const room = { id: 'room-1', roomNumber: 'A101', status: 'available', buildingId: 'b-1', monthlyRent: 3_000_000 }
const contract = { id: 'c-1', tenantId: 't-1', roomId: 'room-1', buildingId: 'b-1', status: 'active', occupantCount: 3 }

function createInput(extra: Record<string, unknown> = {}) {
  return {
    request_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b800000',
    room_id: 'room-1',
    tenant_id: 't-new',
    start_date: '2026-12-01',
    end_date: '2027-12-01',
    monthly_rent: 3_000_000,
    deposit: 0,
    occupant_count: 3,
    discount_amount: 0,
    surcharge_amount: 0,
    status: 'active' as const,
    handover_electricity_reading: 1,
    handover_water_reading: 1,
    ...extra,
  }
}

const notLinkable = Object.assign(new Error('not linkable'), { statusCode: 404, data: { error: { code: 'TENANT_NOT_LINKABLE' } } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertLinkable.mockResolvedValue(undefined)
  mocks.findRoomById.mockResolvedValue(room)
  mocks.findActiveByRoomId.mockResolvedValue(null)
  mocks.findActiveByTenantId.mockResolvedValue(null)
  mocks.findActiveOccupancyByTenant.mockResolvedValue(null)
  mocks.findActiveByTenant.mockResolvedValue(null)
  mocks.listByContract.mockResolvedValue([])
  mocks.createFull.mockResolvedValue({ contract: { ...contract, id: 'c-new' }, replayed: true })
  mocks.findByIdentifier.mockResolvedValue(contract)
  mocks.findById.mockResolvedValue(contract)
  mocks.update.mockImplementation(async (_e, _id, input) => ({ ...contract, ...input }))
})

async function contracts() {
  return (await import('../../../server/services/contracts')).ContractService
}

describe('ContractService.create tenant linking', () => {
  it('checks primary and every roommate against the room building with their tokens', async () => {
    await (await contracts()).create(event, owner, createInput({
      tenant_link_token: 'tok-primary',
      occupants: [{ tenant_id: 't-room', link_token: 'tok-room', billing_counted: true }],
    }) as never)
    expect(mocks.assertLinkable).toHaveBeenCalledWith(event, owner, 't-new', { buildingId: 'b-1', linkToken: 'tok-primary' })
    expect(mocks.assertLinkable).toHaveBeenCalledWith(event, owner, 't-room', { buildingId: 'b-1', linkToken: 'tok-room' })
    const [, payload] = mocks.createFull.mock.calls[0]!
    expect(payload.occupants).toEqual([{ tenant_id: 't-room', move_in_date: undefined, billing_counted: true }])
    expect(JSON.stringify(payload)).not.toContain('tok-')
  })

  it('rejects a spoofed out-of-scope tenant before writing anything', async () => {
    mocks.assertLinkable.mockRejectedValueOnce(notLinkable)
    await expect((await contracts()).create(event, owner, createInput() as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.createFull).not.toHaveBeenCalled()
  })

  it('rejects a spoofed roommate', async () => {
    mocks.assertLinkable.mockResolvedValueOnce(undefined).mockRejectedValueOnce(notLinkable)
    await expect((await contracts()).create(event, owner, createInput({
      occupants: [{ tenant_id: 't-other', billing_counted: true }],
    }) as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.createFull).not.toHaveBeenCalled()
  })

  it('always derives building_id from the room, ignoring the client value', async () => {
    await (await contracts()).create(event, owner, createInput({ building_id: '11111111-1111-4111-8111-111111111111' }) as never)
    const [, payload] = mocks.createFull.mock.calls[0]!
    expect(payload.contract.building_id).toBe('b-1')
  })
})

describe('ContractService.update tenant linking', () => {
  it('checks a changed tenant against the contract building', async () => {
    await (await contracts()).update(event, owner, 'c-1', { tenant_id: 't-new', tenant_link_token: 'tok' } as never)
    expect(mocks.assertLinkable).toHaveBeenCalledWith(event, owner, 't-new', { buildingId: 'b-1', linkToken: 'tok' })
    expect(mocks.update.mock.calls[0]![2]).not.toHaveProperty('tenant_link_token')
  })

  it('does not re-check an unchanged tenant', async () => {
    await (await contracts()).update(event, owner, 'c-1', { tenant_id: 't-1', notes: 'x' } as never)
    expect(mocks.assertLinkable).not.toHaveBeenCalled()
  })

  it('rejects a spoofed tenant change without writing', async () => {
    mocks.assertLinkable.mockRejectedValueOnce(notLinkable)
    await expect((await contracts()).update(event, owner, 'c-1', { tenant_id: 't-x' } as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('never writes a client building_id', async () => {
    await (await contracts()).update(event, owner, 'c-1', { building_id: 'b-evil', notes: 'x' } as never)
    expect(mocks.update.mock.calls[0]![2]).not.toHaveProperty('building_id')
  })

  it('rejects moving the contract to a room in another building', async () => {
    mocks.findRoomById.mockImplementation(async (_e: unknown, id: string) => (id === 'room-2' ? { ...room, id: 'room-2', buildingId: 'b-2' } : room))
    await expect((await contracts()).update(event, owner, 'c-1', { room_id: 'room-2' } as never))
      .rejects.toMatchObject({ statusCode: 409, data: { error: { details: { reason: 'CONTRACT_ROOM_BUILDING_CHANGE' } } } })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('ContractOccupantService.add tenant linking', () => {
  it('checks the roommate against the contract building with its token', async () => {
    mocks.insertOccupant.mockResolvedValue({ id: 'o-1' })
    const { ContractOccupantService } = await import('../../../server/services/contract-occupants')
    await ContractOccupantService.add(event, owner, 'c-1', { tenant_id: 't-room', role: 'roommate', move_in_date: '2026-12-01', billing_counted: true, link_token: 'tok' } as never)
    expect(mocks.assertLinkable).toHaveBeenCalledWith(event, owner, 't-room', { buildingId: 'b-1', linkToken: 'tok' })
  })

  it('rejects a spoofed roommate without inserting', async () => {
    mocks.assertLinkable.mockRejectedValueOnce(notLinkable)
    const { ContractOccupantService } = await import('../../../server/services/contract-occupants')
    await expect(ContractOccupantService.add(event, owner, 'c-1', { tenant_id: 't-x', role: 'roommate', move_in_date: '2026-12-01', billing_counted: true } as never))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.insertOccupant).not.toHaveBeenCalled()
  })
})
