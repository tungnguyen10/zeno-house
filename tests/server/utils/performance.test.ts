import { describe, expect, it } from 'vitest'
import {
  finishApiPerformance,
  instrumentQueryBuilder,
  startApiPerformance,
} from '../../../server/utils/performance'

function event(method = 'GET') {
  return { method, context: {} } as never
}

describe('API performance instrumentation', () => {
  it('records request duration, response bytes, and read thresholds', () => {
    const target = event()
    startApiPerformance(target, { requestId: 'request-1', now: 100 })

    const result = finishApiPerformance(target, { data: 'ok' }, { now: 701 })

    expect(result).toEqual({
      requestId: 'request-1',
      durationMs: 601,
      dbRoundTrips: 0,
      responseBytes: 13,
      slow: true,
    })
  })

  it('uses the mutation slow threshold', () => {
    const target = event('POST')
    startApiPerformance(target, { now: 0 })

    expect(finishApiPerformance(target, null, { now: 750 }).slow).toBe(false)
    expect(finishApiPerformance(target, null, { now: 1001 }).slow).toBe(true)
  })

  it('counts an awaited query chain once', async () => {
    const target = event()
    startApiPerformance(target, { now: 0 })
    const query = {
      select() { return this },
      eq() { return this },
      then(resolve: (value: unknown) => void) { return Promise.resolve({ data: [] }).then(resolve) },
    }

    await instrumentQueryBuilder(target, query).select().eq()

    expect(target.context.apiPerformance.dbRoundTrips).toBe(1)
  })
})
