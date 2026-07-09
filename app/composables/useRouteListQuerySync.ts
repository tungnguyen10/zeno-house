import type { LocationQuery } from 'vue-router'
import type { Ref, WatchSource } from 'vue'

interface UseRouteListQuerySyncOptions {
  page?: Ref<number>
  resetPageOn?: WatchSource[]
  syncOn?: WatchSource[]
  parseRoute: (query: LocationQuery) => void
  buildQuery: (query: LocationQuery) => Record<string, string | string[] | undefined>
}

/** Read a route query value as a trimmed string, falling back when absent/non-string. */
export function readQueryString(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback
}

/** Read a route query value as a bounded integer with a fallback. */
export function readQueryNumber(
  raw: unknown,
  options: { fallback: number, min?: number, max?: number },
): number {
  const parsed = Number(raw ?? options.fallback) || options.fallback
  let value = parsed
  if (options.min !== undefined) value = Math.max(options.min, value)
  if (options.max !== undefined) value = Math.min(options.max, value)
  return value
}

/** Read a route query value as one of the allowed enum values, or the fallback. */
export function readQueryEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  const value = typeof raw === 'string' ? raw : ''
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Read a route query value (string or string[]) as a filtered array of allowed enum values. */
export function readQueryEnumArray<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return arr
    .map(v => String(v))
    .filter((v): v is T => (allowed as readonly string[]).includes(v))
}

/** Copy existing string / string[] query entries, dropping null/undefined values. */
export function copyStringQuery(query: LocationQuery): Record<string, string | string[] | undefined> {
  const next: Record<string, string | string[] | undefined> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      const filtered = value.filter((item): item is string => typeof item === 'string')
      if (filtered.length > 0) next[key] = filtered
    }
    else if (typeof value === 'string') {
      next[key] = value
    }
  }
  return next
}

function compactQuery(query: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    next[key] = value
  }
  return next
}

export function useRouteListQuerySync(options: UseRouteListQuerySyncOptions) {
  const route = useRoute()
  const router = useRouter()
  const syncingFromRoute = ref(false)

  function replaceRoute() {
    const next = compactQuery(options.buildQuery(route.query))
    router.replace({ query: next })
  }

  if (options.resetPageOn?.length) {
    watch(options.resetPageOn, () => {
      if (syncingFromRoute.value) return

      if (options.page && options.page.value !== 1) {
        options.page.value = 1
        return
      }

      replaceRoute()
    }, { deep: true })
  }

  if (options.syncOn?.length) {
    watch(options.syncOn, () => {
      if (syncingFromRoute.value) return
      replaceRoute()
    }, { deep: true })
  }

  watch(() => route.query, (query) => {
    syncingFromRoute.value = true
    options.parseRoute(query)
    nextTick(() => {
      syncingFromRoute.value = false
    })
  })

  return {
    replaceRoute,
  }
}