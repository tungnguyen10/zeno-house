import { setResponseHeader } from 'h3'
import { finishApiPerformance, startApiPerformance } from '../utils/performance'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (!event.path.startsWith('/api/')) return
    const requestId = event.headers.get('x-request-id')?.trim() || undefined
    const context = startApiPerformance(event, { requestId })
    setResponseHeader(event, 'x-request-id', context.requestId)
  })

  nitroApp.hooks.hook('beforeResponse', (event, response) => {
    if (!event.path.startsWith('/api/')) return
    const result = finishApiPerformance(event, response.body)
    setResponseHeader(
      event,
      'server-timing',
      [
        `app;dur=${result.durationMs.toFixed(1)}`,
        `auth;dur=${result.timings.auth.toFixed(1)}`,
        `namespace;dur=${result.timings.namespace.toFixed(1)}`,
        `db;dur=${result.timings.db.toFixed(1)};desc="${result.dbRoundTrips} round-trips"`,
        `storage;dur=${result.timings.storage.toFixed(1)};desc="${result.storageRoundTrips} round-trips"`,
        `external;dur=${result.timings.external.toFixed(1)};desc="${result.externalRoundTrips} round-trips"`,
      ].join(', '),
    )

    const status = event.node.res.statusCode
    if (!result.slow && status < 500) return

    console.warn('[api-performance]', {
      requestId: result.requestId,
      method: event.method,
      route: event.path,
      status,
      durationMs: Number(result.durationMs.toFixed(1)),
      dbRoundTrips: result.dbRoundTrips,
      storageRoundTrips: result.storageRoundTrips,
      externalRoundTrips: result.externalRoundTrips,
      timings: Object.fromEntries(
        Object.entries(result.timings).map(([key, value]) => [key, Number(value.toFixed(1))]),
      ),
      region: result.region,
      coldStart: result.coldStart,
      responseBytes: result.responseBytes,
      slow: result.slow,
    })
  })
})
