import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findByIdentifier = vi.fn()
const list = vi.fn()
const replace = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findByIdentifier } }))
vi.mock('../../../server/repositories/contract-vehicles', () => ({ ContractVehicleRepository: { list, replace } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope, canDeleteMasterData: vi.fn(), getVisibleBuildingIds: vi.fn() }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never
const row = { id: 'v-1', contract_id: 'c-1', owner_name: 'A', plate_number: '59X1 12345', vehicle_type: null, note: null, sort_order: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (u: AuthUser, cap: string) => {
    const role = String(u.app_metadata?.role)
    if (cap === 'contracts.update') return ['admin', 'owner'].includes(role)
    return true
  })
  findByIdentifier.mockResolvedValue({ id: 'c-1', buildingId: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
  list.mockResolvedValue([row])
  replace.mockResolvedValue([row])
})

describe('ContractService vehicles', () => {
  it('maps vehicles for a reader', async () => {
    const { ContractService } = await import('../../../server/services/contracts')
    const res = await ContractService.getVehicles(ev(), owner, 'c-1')
    expect(res).toEqual([{ id: 'v-1', ownerName: 'A', plateNumber: '59X1 12345', vehicleType: null, note: null, sortOrder: 0 }])
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'read')
  })

  it('replaces and audits with a count', async () => {
    const { ContractService } = await import('../../../server/services/contracts')
    await ContractService.saveVehicles(ev(), owner, 'c-1', [{ owner_name: 'A', plate_number: '59X1 12345', vehicle_type: null, note: null }] as never)
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
    expect(replace).toHaveBeenCalledWith(expect.anything(), 'c-1', expect.any(Array))
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({ action: 'contract.vehicles.updated', metadata: { count: 1 } })
  })

  it('forbids managers from saving vehicles', async () => {
    const { ContractService } = await import('../../../server/services/contracts')
    await expect(ContractService.saveVehicles(ev(), manager, 'c-1', [] as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(replace).not.toHaveBeenCalled()
  })
})
