import type { H3Event } from 'h3'

export interface ApiPerformanceContext {
  requestId: string
  startedAt: number
  dbRoundTrips: number
  storageRoundTrips: number
  externalRoundTrips: number
  timings: ApiTimingBreakdown
  coldStart: boolean
  region: string | null
}

export type ApiTimingCategory = 'auth' | 'namespace' | 'db' | 'storage' | 'external'
export type ApiTimingBreakdown = Record<ApiTimingCategory, number>

export interface ApiPerformanceResult {
  requestId: string
  durationMs: number
  dbRoundTrips: number
  storageRoundTrips: number
  externalRoundTrips: number
  timings: ApiTimingBreakdown
  coldStart: boolean
  region: string | null
  responseBytes: number | null
  slow: boolean
}

const READ_SLOW_MS = 500
const MUTATION_SLOW_MS = 1000
let coldStartPending = true

function emptyTimings(): ApiTimingBreakdown {
  return { auth: 0, namespace: 0, db: 0, storage: 0, external: 0 }
}

export function startApiPerformance(
  event: H3Event,
  options: {
    requestId?: string
    now?: number
    coldStart?: boolean
    region?: string | null
  } = {},
): ApiPerformanceContext {
  const existing = event.context.apiPerformance
  if (existing) return existing

  const context: ApiPerformanceContext = {
    requestId: options.requestId ?? crypto.randomUUID(),
    startedAt: options.now ?? performance.now(),
    dbRoundTrips: 0,
    storageRoundTrips: 0,
    externalRoundTrips: 0,
    timings: emptyTimings(),
    coldStart: options.coldStart ?? coldStartPending,
    region: options.region ?? process.env.VERCEL_REGION ?? null,
  }
  if (options.coldStart === undefined) coldStartPending = false
  event.context.apiPerformance = context
  return context
}

export function recordDbRoundTrip(event: H3Event): void {
  const context = event.context.apiPerformance ?? startApiPerformance(event)
  context.dbRoundTrips += 1
}

function recordRoundTrip(event: H3Event, category: 'db' | 'storage' | 'external'): void {
  const context = event.context.apiPerformance ?? startApiPerformance(event)
  if (category === 'db') context.dbRoundTrips += 1
  else if (category === 'storage') context.storageRoundTrips += 1
  else context.externalRoundTrips += 1
}

export function recordApiTiming(
  event: H3Event,
  category: ApiTimingCategory,
  durationMs: number,
): void {
  const context = event.context.apiPerformance ?? startApiPerformance(event)
  context.timings[category] += Math.max(0, durationMs)
}

export async function measureApiSegment<T>(
  event: H3Event,
  category: ApiTimingCategory,
  operation: () => Promise<T>,
  options: { now?: () => number } = {},
): Promise<T> {
  const now = options.now ?? performance.now.bind(performance)
  const startedAt = now()
  try {
    return await operation()
  }
  finally {
    recordApiTiming(event, category, now() - startedAt)
  }
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
    storageRoundTrips: context.storageRoundTrips,
    externalRoundTrips: context.externalRoundTrips,
    timings: { ...context.timings },
    coldStart: context.coldStart,
    region: context.region,
    responseBytes: byteLength(body),
    slow: durationMs > threshold,
  }
}

export function instrumentQueryBuilder<T>(
  event: H3Event,
  value: T,
  category: 'db' | 'storage' | 'external' = 'db',
): T {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return value

  return new Proxy(value as object, {
    get(target, property, receiver) {
      if (property === 'then' && typeof Reflect.get(target, property, receiver) === 'function') {
        return (...args: unknown[]) => {
          recordRoundTrip(event, category)
          const startedAt = performance.now()
          let recorded = false
          const finish = () => {
            if (recorded) return
            recorded = true
            recordApiTiming(event, category, performance.now() - startedAt)
          }
          const then = Reflect.get(target, property, target) as (...values: unknown[]) => unknown
          const [resolve, reject] = args as [
            ((value: unknown) => unknown) | undefined,
            ((error: unknown) => unknown) | undefined,
          ]
          return then.call(
            target,
            (value: unknown) => {
              finish()
              return resolve ? resolve(value) : value
            },
            (error: unknown) => {
              finish()
              if (reject) return reject(error)
              throw error
            },
          )
        }
      }

      const member = Reflect.get(target, property, receiver)
      const childCategory = property === 'storage'
        ? 'storage'
        : property === 'auth'
          ? 'external'
          : category
      if (typeof member !== 'function') {
        return instrumentQueryBuilder(event, member, childCategory)
      }

      return (...args: unknown[]) => {
        const result = member.apply(target, args)
        return instrumentQueryBuilder(event, result, childCategory)
      }
    },
  }) as T
}
