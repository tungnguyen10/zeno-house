import type { MaybeRefOrGetter } from 'vue'

/** Refresh server-owned data after returning from a bank app; never change payment state locally. */
export function usePortalRefreshOnReturn(
  refresh: () => Promise<unknown>,
  sessionKey: MaybeRefOrGetter<string>,
) {
  const originalSession = toValue(sessionKey)
  let lastRefresh = 0
  let refreshing = false
  let leftPage = false

  async function refreshIfCurrent() {
    if (refreshing || document.visibilityState === 'hidden' || !navigator.onLine) return
    if (toValue(sessionKey) !== originalSession || Date.now() - lastRefresh < 3_000) return
    refreshing = true
    lastRefresh = Date.now()
    try {
      await refresh()
    }
    catch {
      // The consumer renders its useFetch error and an explicit retry action.
    }
    finally {
      refreshing = false
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      leftPage = true
      return
    }
    if (leftPage) {
      leftPage = false
      void refreshIfCurrent()
    }
  }

  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) void refreshIfCurrent()
  }

  function onOnline() { void refreshIfCurrent() }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('online', onOnline)
  })
}
