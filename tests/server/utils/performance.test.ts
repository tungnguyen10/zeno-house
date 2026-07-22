import { describe, expect, it, vi } from 'vitest'
import {
  finishApiPerformance,
  instrumentQueryBuilder,
  measureApiSegment,
  startApiPerformance,
} from '../../../server/utils/performance'

function event(method = 'GET') {
  return { method, context: {} } as never
}

describe('API performance instrumentation', () => {
  it('records request duration, response bytes, and read thresholds', () => {
    const target = event()
    startApiPerformance(target, {
      requestId: 'request-1',
      now: 100,
      coldStart: false,
      region: 'sin1',
    })

    const result = finishApiPerformance(target, { data: 'ok' }, { now: 701 })

    expect(result).toEqual({
      requestId: 'request-1',
      durationMs: 601,
      dbRoundTrips: 0,
      storageRoundTrips: 0,
      externalRoundTrips: 0,
      timings: { auth: 0, namespace: 0, db: 0, storage: 0, external: 0 },
      coldStart: false,
      region: 'sin1',
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

  it('records named auth and namespace timing segments', async () => {
    const target = event()
    startApiPerformance(target, { now: 0 })
    const authNow = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(25)
    const namespaceNow = vi.fn().mockReturnValueOnce(30).mockReturnValueOnce(40)

    await measureApiSegment(target, 'auth', async () => 'user', { now: authNow })
    await measureApiSegment(target, 'namespace', async () => 'scope', { now: namespaceNow })

    expect(target.context.apiPerformance.timings).toMatchObject({ auth: 15, namespace: 10 })
  })

  it('separates storage and external Supabase calls from database round trips', async () => {
    const target = event()
    startApiPerformance(target, { now: 0 })
    const operation = {
      then(resolve: (value: unknown) => void) { return Promise.resolve({ data: null }).then(resolve) },
    }

    await instrumentQueryBuilder(target, operation, 'storage')
    await instrumentQueryBuilder(target, operation, 'external')

    expect(target.context.apiPerformance).toMatchObject({
      dbRoundTrips: 0,
      storageRoundTrips: 1,
      externalRoundTrips: 1,
    })
  })
})
