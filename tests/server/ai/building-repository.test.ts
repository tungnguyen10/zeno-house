import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiBuildingRepository } from '../../../server/repositories/ai/buildings'

const mocks = vi.hoisted(() => ({ db: vi.fn() }))
vi.mock('../../../server/utils/db', () => ({ db: mocks.db }))

const building = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'zeno-central',
  name: 'Zeno Central',
  address: '1 Main',
  status: 'active',
  updated_at: '2026-07-14T00:00:00.000Z',
}

function clientWith(results: unknown[][]) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  class Query {
    private readonly result = results.shift() ?? []

    select(...args: unknown[]) { calls.push({ method: 'select', args }); return this }
    order(...args: unknown[]) { calls.push({ method: 'order', args }); return this }
    limit(...args: unknown[]) { calls.push({ method: 'limit', args }); return this }
    eq(...args: unknown[]) { calls.push({ method: 'eq', args }); return this }
    ilike(...args: unknown[]) { calls.push({ method: 'ilike', args }); return this }
    in(...args: unknown[]) { calls.push({ method: 'in', args }); return this }
    then<TResult1 = unknown>(onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null) {
      return Promise.resolve({ data: this.result, error: null }).then(onfulfilled)
    }
  }
  return { calls, client: { from: () => new Query() } }
}

describe('AiBuildingRepository scoped resolution', () => {
  beforeEach(() => vi.clearAllMocks())

  it('short-circuits an empty assigned scope without querying', async () => {
    await expect(AiBuildingRepository.resolveScoped({} as never, 'Zeno Central', [])).resolves.toEqual([])
    expect(mocks.db).not.toHaveBeenCalled()
  })

  it('resolves a UUID inside the supplied scope filter', async () => {
    const mock = clientWith([[building]])
    mocks.db.mockReturnValue(mock.client)
    await expect(AiBuildingRepository.resolveScoped(
      {} as never, building.id, [building.id],
    )).resolves.toMatchObject([{ id: building.id }])
    expect(mock.calls).toContainEqual({ method: 'eq', args: ['id', building.id] })
    expect(mock.calls).toContainEqual({ method: 'in', args: ['id', [building.id]] })
  })

  it('prefers an exact slug before querying an exact case-insensitive name', async () => {
    const slugMock = clientWith([[building]])
    mocks.db.mockReturnValue(slugMock.client)
    await expect(AiBuildingRepository.resolveScoped(
      {} as never, building.slug, [building.id],
    )).resolves.toMatchObject([{ slug: building.slug }])
    expect(slugMock.calls).toContainEqual({ method: 'eq', args: ['slug', building.slug] })
    expect(slugMock.calls.some(call => call.method === 'ilike')).toBe(false)

    const nameMock = clientWith([[], [building, { ...building, id: 'building-2', slug: 'zeno-central-2' }]])
    mocks.db.mockReturnValue(nameMock.client)
    await expect(AiBuildingRepository.resolveScoped(
      {} as never, building.name, [building.id, 'building-2'],
    )).resolves.toHaveLength(2)
    expect(nameMock.calls).toContainEqual({ method: 'ilike', args: ['name', building.name] })
    expect(nameMock.calls.filter(call => call.method === 'in')).toHaveLength(2)
  })
})
