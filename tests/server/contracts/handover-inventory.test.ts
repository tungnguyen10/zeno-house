import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('throwDbError', (error: unknown) => { throw error })
})

const item = { id: 'i-1', name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null, sort_order: 0 }

describe('ContractRepository.findHandoverInventory', () => {
  it('resolves the nearest contract in the renewal chain with one RPC', async () => {
    rpc.mockResolvedValue({
      data: { source_contract_id: 'c-1', source_contract_code: 'hd-1', items: [item] },
      error: null,
    })
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-3')

    expect(rpc).toHaveBeenCalledExactlyOnceWith('find_handover_inventory', { p_contract_id: 'c-3' })
    expect(res).toMatchObject({ sourceContractId: 'c-1', sourceContractCode: 'hd-1', items: [{ name: 'Giường' }] })
  })

  it('returns empty when no contract in the chain has items', async () => {
    rpc.mockResolvedValue({
      data: { source_contract_id: null, source_contract_code: null, items: [] },
      error: null,
    })
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-1')
    expect(res).toEqual({ sourceContractId: null, sourceContractCode: null, items: [] })
  })

  it('propagates RPC failures', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') })
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    await expect(ContractRepository.findHandoverInventory({ context: {} } as never, 'c-1')).rejects.toThrow('boom')
  })
})
