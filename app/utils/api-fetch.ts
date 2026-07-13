import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'

const DEFAULT_API_TIMEOUT_MS = 15_000
const inFlightRequests = new Map<string, Promise<unknown>>()

export type ApiFetchOptions = NitroFetchOptions<NitroFetchRequest> & {
  /** Share one in-flight imperative GET. Do not use for mutations. */
  dedupeKey?: string
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Shared mutation/imperative API client. Initial SSR reads continue to use useFetch. */
export function apiFetch<T>(
  request: NitroFetchRequest,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { dedupeKey, ...fetchOptions } = options
  if (dedupeKey) {
    const existing = inFlightRequests.get(dedupeKey)
    if (existing) return existing as Promise<T>
  }
  const headers = new Headers(options.headers as HeadersInit | undefined)
  if (!headers.has('x-request-id')) headers.set('x-request-id', requestId())
  const pending = ($fetch<T>(request, {
    timeout: DEFAULT_API_TIMEOUT_MS,
    retry: 0,
    ...fetchOptions,
    headers,
  }) as unknown as Promise<T>).catch((error: unknown) => {
    const existing = error as { data?: { error?: { code?: string } }, name?: string }
    if (existing.data?.error?.code || existing.name === 'AbortError') throw error
    throw {
      data: {
        error: {
          code: 'INTERNAL',
          message: 'Yêu cầu mất quá nhiều thời gian hoặc kết nối bị gián đoạn.',
        },
      },
      cause: error,
    }
  })
  if (!dedupeKey) return pending
  inFlightRequests.set(dedupeKey, pending)
  void pending.finally(() => {
    if (inFlightRequests.get(dedupeKey) === pending) inFlightRequests.delete(dedupeKey)
  }).catch(() => undefined)
  return pending
}

/** Abort the previous imperative read so stale responses cannot overwrite new filters. */
export function createLatestApiRequest() {
  let controller: AbortController | null = null
  return async function latest<T>(
    request: NitroFetchRequest,
    options: ApiFetchOptions = {},
  ): Promise<T> {
    controller?.abort()
    controller = new AbortController()
    return apiFetch<T>(request, { ...options, signal: controller.signal })
  }
}
