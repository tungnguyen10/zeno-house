import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ from }) }))

function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) c[m] = () => c
  c.maybeSingle = async () => result
  c.then = (resolve: (v: unknown) => void) => resolve(result)
  return c
}

beforeEach(() => vi.clearAllMocks())

describe('ContractRepository.findHandoverInventory', () => {
  it('walks previous_contract_id to the original contract', async () => {
    const contractsCalls = [
      { data: { id: 'c-3', contract_code: 'hd-3', previous_contract_id: 'c-2' }, error: null },
      { data: { id: 'c-2', contract_code: 'hd-2', previous_contract_id: 'c-1' }, error: null },
      { data: { id: 'c-1', contract_code: 'hd-1', previous_contract_id: null }, error: null },
    ]
    const itemsCalls = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ id: 'i-1', name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null, sort_order: 0 }], error: null },
    ]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : itemsCalls.shift()))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-3')
    expect(res).toMatchObject({ sourceContractId: 'c-1', sourceContractCode: 'hd-1', items: [{ name: 'Giường' }] })
  })

  it('returns empty when no contract in the chain has items', async () => {
    const contractsCalls = [{ data: { id: 'c-1', contract_code: 'hd-1', previous_contract_id: null }, error: null }]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : { data: [], error: null }))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-1')
    expect(res).toEqual({ sourceContractId: null, sourceContractCode: null, items: [] })
  })
})
