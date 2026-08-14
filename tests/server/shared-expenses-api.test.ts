import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'

const list = vi.fn()

vi.mock('../../server/services/shared-expenses', () => ({
  SharedExpenseService: { list },
}))

vi.stubGlobal('requireAuth', vi.fn(async () => ({ id: 'owner-1' })))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('parseQuery', (event: { context: { query?: unknown } }, schema: ZodType) =>
  schema.parse(event.context.query ?? {}))

describe('GET /api/shared-expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue([])
  })

  it('validates the selected period and returns it in response meta', async () => {
    const { default: handler } = await import('../../server/api/shared-expenses/index.get')
    const event = { context: { query: { period_year: '2026', period_month: '7' } } }

    const result = await handler(event as never)

    expect(list).toHaveBeenCalledWith(expect.anything(), { id: 'owner-1' }, {
      period_year: 2026,
      period_month: 7,
    })
    expect(result).toEqual({ data: [], meta: { periodYear: 2026, periodMonth: 7 } })
  })

  it('rejects a missing or invalid period', async () => {
    const { default: handler } = await import('../../server/api/shared-expenses/index.get')

    await expect(handler({ context: { query: {} } } as never)).rejects.toThrow()
    await expect(handler({ context: { query: { period_year: '2026', period_month: '13' } } } as never)).rejects.toThrow()
  })
})
