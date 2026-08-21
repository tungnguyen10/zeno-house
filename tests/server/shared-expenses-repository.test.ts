import { beforeEach, describe, expect, it, vi } from 'vitest'

const serverSupabaseClient = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseClient,
  serverSupabaseServiceRole: serverSupabaseClient,
}))

describe('SharedExpenseRepository allocation lookup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads one period marker set and returns unique shared expense ids', async () => {
    const calls: Array<{ column: string; pattern: string }> = []
    const query = {
      select: vi.fn(() => query),
      ilike: vi.fn((column: string, pattern: string) => {
        calls.push({ column, pattern })
        return Promise.resolve({
          data: [
            { note: 'Phí dùng chung [shared:11111111-1111-4111-8111-111111111111:2026-07]' },
            { note: 'Điều chỉnh [shared:11111111-1111-4111-8111-111111111111:2026-07]' },
            { note: '[shared:22222222-2222-4222-8222-222222222222:2026-07]' },
          ],
          error: null,
        })
      }),
    }
    serverSupabaseClient.mockResolvedValue({ from: vi.fn(() => query) })
    const { SharedExpenseRepository } = await import('../../server/repositories/shared-expenses')

    const ids = await SharedExpenseRepository.allocatedSharedExpenseIdsForPeriod(
      {} as never,
      2026,
      7,
    )

    expect(calls).toEqual([{ column: 'note', pattern: '%[shared:%:2026-07]%' }])
    expect([...ids]).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ])
  })
})
