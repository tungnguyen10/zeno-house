import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findByIdentifier = vi.fn()
const replaceContract = vi.fn()
const findHandoverInventory = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: { findByIdentifier, findHandoverInventory },
}))
vi.mock('../../../server/repositories/inventory', () => ({
  InventoryRepository: { replaceContract },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope, canDeleteMasterData: vi.fn(), getVisibleBuildingIds: vi.fn() }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never
const items = [{ name: 'Tủ', quantity: 1, condition: 'good' as const, unit_value: null, note: null }]

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (u: AuthUser, cap: string) => {
    const role = String(u.app_metadata?.role)
    if (cap === 'contracts.update') return ['admin', 'owner'].includes(role)
    return true
  })
  findByIdentifier.mockResolvedValue({ id: 'c-1', buildingId: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
  replaceContract.mockResolvedValue([])
  findHandoverInventory.mockResolvedValue({ items: [], sourceContractId: 'c-1' })
})

describe('ContractService.updateHandoverInventory', () => {
  it('owner replaces items for this contract only', async () => {
    const { ContractService } = await import('../../../server/services/contracts')
    await ContractService.updateHandoverInventory(ev(), owner, 'c-1', items as never)
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
    expect(replaceContract).toHaveBeenCalledWith(expect.anything(), 'c-1', items)
  })

  it('forbids managers without contracts.update', async () => {
    const { ContractService } = await import('../../../server/services/contracts')
    await expect(ContractService.updateHandoverInventory(ev(), manager, 'c-1', items as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(replaceContract).not.toHaveBeenCalled()
  })

  it('maps the lock error to 409', async () => {
    replaceContract.mockRejectedValue(Object.assign(new Error('CONTRACT_INVENTORY_LOCKED'), {
      statusCode: 409, data: { error: { code: 'CONFLICT', details: { reason: 'CONTRACT_INVENTORY_LOCKED' } } },
    }))
    const { ContractService } = await import('../../../server/services/contracts')
    await expect(ContractService.updateHandoverInventory(ev(), owner, 'c-1', items as never)).rejects.toMatchObject({ statusCode: 409 })
  })
})
