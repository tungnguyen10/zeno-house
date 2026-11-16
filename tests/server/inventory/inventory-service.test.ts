import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const repo = vi.hoisted(() => ({
  listTemplate: vi.fn(), replaceTemplate: vi.fn(), listRoom: vi.fn(), replaceRoom: vi.fn(), applyTemplate: vi.fn(), listContract: vi.fn(),
}))
const findBuilding = vi.fn()
const findRoom = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/inventory', () => ({ InventoryRepository: repo }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: findBuilding } }))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { findByIdentifier: findRoom } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const CAPS: Record<string, string[]> = {
  owner: ['rooms.read', 'rooms.update', 'buildings.update'],
  manager: ['rooms.read', 'rooms.update'],
}
const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never
const row = (id: string, name: string) => ({ id, name, quantity: 1, condition: 'good', unit_value: null, note: null, sort_order: 0 })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (u: AuthUser, cap: string) => CAPS[String(u.app_metadata?.role)]?.includes(cap) ?? false)
  findBuilding.mockResolvedValue({ id: 'b-1' })
  findRoom.mockResolvedValue({ id: 'r-1', buildingId: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
})

describe('InventoryService', () => {
  it('manager cannot edit the template', async () => {
    const { InventoryService } = await import('../../../server/services/inventory')
    await expect(InventoryService.saveTemplate(ev(), manager, 'b-1', [])).rejects.toMatchObject({ statusCode: 403 })
    expect(repo.replaceTemplate).not.toHaveBeenCalled()
  })

  it('owner saves template and audits item_count', async () => {
    repo.replaceTemplate.mockResolvedValue([row('t-1', 'Giường'), row('t-2', 'Tủ')])
    const { InventoryService } = await import('../../../server/services/inventory')
    const items = await InventoryService.saveTemplate(ev(), owner, 'b-1', [{ name: 'Giường' }, { name: 'Tủ' }] as never)
    expect(items).toHaveLength(2)
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({ action: 'building.inventory_template.updated', metadata: { item_count: 2 } })
  })

  it('manager can edit room inventory and audit counts diff', async () => {
    repo.listRoom.mockResolvedValue([row('i-1', 'Giường'), row('i-2', 'Tủ')])
    repo.replaceRoom.mockResolvedValue([row('i-3', 'Giường'), row('i-4', 'Máy lạnh')])
    const { InventoryService } = await import('../../../server/services/inventory')
    await InventoryService.saveRoom(ev(), manager, 'r-1', [{ name: 'Giường', quantity: 2 }, { name: 'Máy lạnh' }] as never)
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({
      action: 'room.inventory.updated', entity_type: 'room', entity_id: 'r-1',
      metadata: { added: 1, removed: 1, changed: 1 },
    })
  })

  it('manager can apply template; scope-violation from DB maps to 403', async () => {
    repo.applyTemplate.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 403 }))
    const { InventoryService } = await import('../../../server/services/inventory')
    await expect(InventoryService.applyTemplate(ev(), manager, 'b-1', { room_ids: ['r-x'], mode: 'merge' }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('apply returns totals and audits mode/room_count', async () => {
    repo.applyTemplate.mockResolvedValue({ 'r-1': 2, 'r-2': 0 })
    const { InventoryService } = await import('../../../server/services/inventory')
    const res = await InventoryService.applyTemplate(ev(), manager, 'b-1', { room_ids: ['r-1', 'r-2'], mode: 'merge' })
    expect(res).toEqual({ appliedRooms: 2, addedItems: 2 })
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({ action: 'room.inventory.template_applied', metadata: { mode: 'merge', room_count: 2 } })
  })
})
