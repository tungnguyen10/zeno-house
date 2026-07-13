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
      `app;dur=${result.durationMs.toFixed(1)}, db;desc="round-trips";dur=${result.dbRoundTrips}`,
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
      responseBytes: result.responseBytes,
      slow: result.slow,
    })
  })
})
