import { expect, it, vi } from 'vitest'

const query = vi.hoisted(() => ({ in: vi.fn() }))
vi.mock('../../../server/utils/db', () => ({
  db: () => ({ from: () => ({ select: () => query }) }),
}))

const VALID_ID = '11111111-1111-4111-8111-111111111111'

it('ignores identifiers that are not UUIDs so they resolve as missing instead of failing the query', async () => {
  query.in.mockResolvedValue({ data: [], error: null })
  const { TenantRepository } = await import('../../../server/repositories/tenants')
  await TenantRepository.findByIds({ context: {} } as never, [VALID_ID, 'kh-2026-0001', VALID_ID])
  expect(query.in).toHaveBeenCalledExactlyOnceWith('id', [VALID_ID])
})

it('skips the query when no identifier is a UUID', async () => {
  query.in.mockClear()
  const { TenantRepository } = await import('../../../server/repositories/tenants')
  expect(await TenantRepository.findByIds({ context: {} } as never, ['kh-2026-0001'])).toEqual([])
  expect(query.in).not.toHaveBeenCalled()
})
