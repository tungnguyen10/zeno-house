import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ok, paginated, parseBody, parseQuery } from '../../../server/utils/api'

function event() {
  return { context: {} } as never
}

describe('parseBody', () => {
  it('returns parsed data on success', async () => {
    const schema = z.object({ name: z.string() })
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ name: 'Zeno', extra: 1 }))

    await expect(parseBody(event(), schema)).resolves.toEqual({ name: 'Zeno' })
  })

  it('throws VALIDATION_ERROR with flattened details on failure', async () => {
    const schema = z.object({ name: z.string() })
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ name: 123 }))

    await expect(parseBody(event(), schema)).rejects.toMatchObject({
      statusCode: 422,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          details: { fieldErrors: { name: expect.any(Array) } },
        },
      },
    })
  })

  it('uses the provided message on failure', async () => {
    const schema = z.object({ name: z.string() })
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({}))

    await expect(parseBody(event(), schema, 'Body sai')).rejects.toMatchObject({
      data: { error: { message: 'Body sai' } },
    })
  })
})

describe('parseQuery', () => {
  it('returns parsed data on success', () => {
    const schema = z.object({ page: z.coerce.number() })
    vi.stubGlobal('getQuery', vi.fn().mockReturnValue({ page: '2' }))

    expect(parseQuery(event(), schema)).toEqual({ page: 2 })
  })

  it('throws VALIDATION_ERROR with flattened details on failure', () => {
    const schema = z.object({ page: z.number() })
    vi.stubGlobal('getQuery', vi.fn().mockReturnValue({ page: 'abc' }))

    expect(() => parseQuery(event(), schema)).toThrowError()
    try {
      parseQuery(event(), schema)
    }
    catch (e) {
      expect(e).toMatchObject({
        statusCode: 422,
        data: { error: { code: 'VALIDATION_ERROR', details: { fieldErrors: { page: expect.any(Array) } } } },
      })
    }
  })
})

describe('ok', () => {
  it('wraps data without meta', () => {
    expect(ok({ id: 1 })).toEqual({ data: { id: 1 } })
  })

  it('includes meta when provided', () => {
    expect(ok([1, 2], { total: 2 })).toEqual({ data: [1, 2], meta: { total: 2 } })
  })
})

describe('paginated', () => {
  it('computes totalPages via ceil', () => {
    expect(paginated([1, 2], { total: 21, page: 1, limit: 20 })).toEqual({
      data: [1, 2],
      meta: { total: 21, page: 1, limit: 20, totalPages: 2 },
    })
  })

  it('returns zero totalPages for empty result', () => {
    expect(paginated([], { total: 0, page: 1, limit: 20 })).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    })
  })
})
