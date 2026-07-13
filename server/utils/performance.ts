import type { H3Event } from 'h3'

export interface ApiPerformanceContext {
  requestId: string
  startedAt: number
  dbRoundTrips: number
}

export interface ApiPerformanceResult {
  requestId: string
  durationMs: number
  dbRoundTrips: number
  responseBytes: number | null
  slow: boolean
}

const READ_SLOW_MS = 500
const MUTATION_SLOW_MS = 1000

export function startApiPerformance(
  event: H3Event,
  options: { requestId?: string, now?: number } = {},
): ApiPerformanceContext {
  const existing = event.context.apiPerformance
  if (existing) return existing

  const context: ApiPerformanceContext = {
    requestId: options.requestId ?? crypto.randomUUID(),
    startedAt: options.now ?? performance.now(),
    dbRoundTrips: 0,
  }
  event.context.apiPerformance = context
  return context
}

export function recordDbRoundTrip(event: H3Event): void {
  const context = event.context.apiPerformance ?? startApiPerformance(event)
  context.dbRoundTrips += 1
}

function byteLength(body: unknown): number | null {
  if (body == null) return 0
  if (typeof body === 'string') return Buffer.byteLength(body)
  if (body instanceof Uint8Array) return body.byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  if (body instanceof Blob) return body.size
  if (typeof body === 'object') {
    try {
      return Buffer.byteLength(JSON.stringify(body))
    }
    catch {
      return null
    }
  }
  return Buffer.byteLength(String(body))
}

export function finishApiPerformance(
  event: H3Event,
  body: unknown,
  options: { now?: number } = {},
): ApiPerformanceResult {
  const context = event.context.apiPerformance ?? startApiPerformance(event, { now: options.now })
  const durationMs = Math.max(0, (options.now ?? performance.now()) - context.startedAt)
  const method = event.method.toUpperCase()
  const threshold = method === 'GET' || method === 'HEAD' ? READ_SLOW_MS : MUTATION_SLOW_MS

  return {
    requestId: context.requestId,
    durationMs,
    dbRoundTrips: context.dbRoundTrips,
    responseBytes: byteLength(body),
    slow: durationMs > threshold,
  }
}

export function instrumentQueryBuilder<T>(event: H3Event, value: T): T {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return value

  return new Proxy(value as object, {
    get(target, property, receiver) {
      if (property === 'then' && typeof Reflect.get(target, property, receiver) === 'function') {
        return (...args: unknown[]) => {
          recordDbRoundTrip(event)
          const then = Reflect.get(target, property, target) as (...values: unknown[]) => unknown
          return then.apply(target, args)
        }
      }

      const member = Reflect.get(target, property, receiver)
      if (typeof member !== 'function') return member

      return (...args: unknown[]) => {
        const result = member.apply(target, args)
        return instrumentQueryBuilder(event, result)
      }
    },
  }) as T
}
