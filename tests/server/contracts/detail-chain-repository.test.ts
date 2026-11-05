import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContractRepository } from '../../../server/repositories/contracts'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../../server/utils/db', () => ({ db: () => ({ from: mocks.from }) }))

const event = {} as never
const id = '00000000-0000-4000-8000-000000000001'
const row = {
  id, contract_code: 'HD-2', previous_contract_id: 'previous-id',
  previous_contract: { id: 'previous-id', contract_code: 'HD-1' }, rooms: null, tenants: null,
}

function query(data: unknown, error: unknown = null) {
  const result = {
    select: vi.fn(() => result), eq: vi.fn(() => result),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  mocks.from.mockReturnValueOnce(result)
  return result
}

describe('contract detail renewal chain repository', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each([id, 'HD-2'])('resolves %s then finds its successor by canonical ID', async (identifier) => {
    const detail = query(row)
    const successor = query({ id: 'successor-id', contract_code: 'HD-3' })
    const result = await ContractRepository.findById(event, identifier)
    expect(detail.eq).toHaveBeenCalledWith(identifier === id ? 'id' : 'contract_code', identifier)
    expect(detail.select).toHaveBeenCalledWith(expect.stringContaining('previous_contract:previous_contract_id(id, contract_code)'))
    expect(successor.select).toHaveBeenCalledWith('id, contract_code')
    expect(successor.eq).toHaveBeenCalledWith('previous_contract_id', id)
    expect(result).toMatchObject({ previousContract: { id: 'previous-id', code: 'HD-1' }, successorContract: { id: 'successor-id', code: 'HD-3' } })
  })

  it('returns null without querying a successor for a missing contract', async () => {
    query(null)
    await expect(ContractRepository.findByIdentifier(event, 'missing')).resolves.toBeNull()
    expect(mocks.from).toHaveBeenCalledOnce()
  })

  it('returns null chain links when no predecessor or successor exists', async () => {
    query({ ...row, previous_contract_id: null, previous_contract: null })
    query(null)
    await expect(ContractRepository.findByIdentifier(event, 'HD-2')).resolves.toMatchObject({ previousContract: null, successorContract: null })
  })

  it.each(['detail', 'successor'])('propagates %s query errors through the shared mapper', async (step) => {
    const error = { message: 'database unavailable' }
    const mapped = new Error('mapped database error')
    const mapper = vi.fn(() => { throw mapped })
    vi.stubGlobal('throwDbError', mapper)
    if (step === 'detail') query(null, error)
    else {
      query(row)
      query(null, error)
    }
    await expect(ContractRepository.findByIdentifier(event, 'HD-2')).rejects.toBe(mapped)
    expect(mapper).toHaveBeenCalledWith(error, `contracts.${step === 'detail' ? 'findByIdentifier' : 'findSuccessor'}`)
    expect(mocks.from).toHaveBeenCalledTimes(step === 'detail' ? 1 : 2)
  })
})
