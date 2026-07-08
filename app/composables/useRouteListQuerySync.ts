import type { LocationQuery } from 'vue-router'
import type { Ref, WatchSource } from 'vue'

interface UseRouteListQuerySyncOptions {
  page?: Ref<number>
  resetPageOn?: WatchSource[]
  syncOn?: WatchSource[]
  parseRoute: (query: LocationQuery) => void
  buildQuery: (query: LocationQuery) => Record<string, string | string[] | undefined>
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