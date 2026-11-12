import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ from }) }))
vi.stubGlobal('throwDbError', (e: unknown) => { throw e })

function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) c[m] = () => c
  c.maybeSingle = async () => result
  c.then = (resolve: (v: unknown) => void) => resolve(result)
  return c
}

const contract = (id: string, prev: string | null) => ({ data: { id, contract_code: `hd-${id}`, previous_contract_id: prev }, error: null })

beforeEach(() => vi.clearAllMocks())

describe('ContractRepository.findHandoverInventory', () => {
  it('walks previous_contract_id to the original contract with items', async () => {
    const contractsCalls = [contract('c-3', 'c-2'), contract('c-2', 'c-1'), contract('c-1', null)]
    const itemsCalls = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ id: 'i-1', name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null, sort_order: 0 }], error: null },
    ]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : itemsCalls.shift()))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-3', 'b-1')
    expect(res).toMatchObject({ sourceContractId: 'c-1', sourceContractCode: 'hd-c-1', items: [{ name: 'Giường' }] })
  })

  it('returns empty when no contract in the chain has items', async () => {
    const contractsCalls = [contract('c-1', null)]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : { data: [], error: null }))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-1', 'b-1')
    expect(res).toEqual({ sourceContractId: null, sourceContractCode: null, items: [] })
  })

  it('stops on cycles and on hops outside the building', async () => {
    const contractsCalls = [contract('c-1', 'c-2'), contract('c-2', 'c-1')]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : { data: [], error: null }))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-1', 'b-1')
    expect(res.items).toEqual([])

    from.mockImplementation((table: string) => chain(table === 'contracts' ? { data: null, error: null } : { data: [], error: null }))
    await expect(ContractRepository.findHandoverInventory({ context: {} } as never, 'c-x', 'b-1')).resolves.toMatchObject({ items: [] })
  })
})
