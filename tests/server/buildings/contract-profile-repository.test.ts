import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../server/utils/db'
import { throwDbError, throwInternal } from '../../../server/utils/errors'
import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'

vi.mock('../../../server/utils/db', () => ({ db: vi.fn() }))

const rawId = '012345678901'
const birth = '1980-01-02'
const address = '12 Lê Lợi, Huế'
const input = buildingContractProfileSchema.parse({ lessor_id_number: rawId })
const result = vi.fn()
const query = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  maybeSingle: result,
  single: result,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('throwDbError', throwDbError)
  vi.stubGlobal('throwInternal', throwInternal)
  vi.mocked(db).mockReturnValue({ from: vi.fn(() => query) } as never)
})
afterEach(() => { vi.restoreAllMocks() })

describe('BuildingContractProfileRepository', () => {
  it('reads by building id and upserts the actor with the validated profile', async () => {
    const { BuildingContractProfileRepository: repository } = await import('../../../server/repositories/building-contract-profiles')
    const row = { building_id: 'b-1', ...input, updated_by: 'o-1' }
    result.mockResolvedValue({ data: row, error: null })
    expect(await repository.findByBuildingId({} as never, 'b-1')).toEqual(row)
    expect(query.eq).toHaveBeenCalledWith('building_id', 'b-1')
    expect(await repository.upsert({} as never, 'b-1', input, 'o-1')).toEqual(row)
    expect(query.upsert).toHaveBeenCalledWith(row, { onConflict: 'building_id' })
    result.mockResolvedValue({ data: null, error: null })
    expect(await repository.findByBuildingId({} as never, 'b-1')).toBeNull()
  })

  for (const operation of ['findByBuildingId', 'upsert'] as const) {
    it('sanitizes rejected database requests on ' + operation, async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { BuildingContractProfileRepository: repository } = await import('../../../server/repositories/building-contract-profiles')
      result.mockRejectedValue(new Error(`${rawId}, ${birth}, ${address}`))
      const request = operation === 'upsert'
        ? repository.upsert({} as never, 'b-1', input, 'o-1')
        : repository.findByBuildingId({} as never, 'b-1')
      const error = await request.catch(error => error)
      expect(error).toMatchObject({ statusCode: 500 })
      for (const value of [rawId, birth, address]) expect(JSON.stringify({ error, logs: log.mock.calls })).not.toContain(value)
      expect(log.mock.calls).toEqual([['[INTERNAL]', `buildingContractProfile.${operation}`, {}, {}]])
    })

    it.each(['23514', '23505', '22P02', '42501', 'PGRST000', rawId])('sanitizes %s failures on ' + operation, async (code) => {
      const logs = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})]
      const { BuildingContractProfileRepository: repository } = await import('../../../server/repositories/building-contract-profiles')
      const pii = `${rawId}, ${birth}, ${address}`
      result.mockResolvedValue({ data: null, error: { code, message: `Invalid input ${pii}`, details: `Failing row contains (${pii})`, hint: pii } })
      let thrown: unknown
      try {
        if (operation === 'upsert') await repository.upsert({} as never, 'b-1', input, 'o-1')
        else await repository.findByBuildingId({} as never, 'b-1')
      }
      catch (error) { thrown = error }
      expect(thrown).toMatchObject({ statusCode: code === '23514' ? 422 : 500 })
      const serialized = JSON.stringify({ error: thrown, message: String(thrown), logs: logs.map(log => log.mock.calls) })
      for (const value of [rawId, birth, address, 'Failing row contains', 'Invalid input']) expect(serialized).not.toContain(value)
    })
  }
})
