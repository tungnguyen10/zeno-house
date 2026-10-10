import { shallowRef } from 'vue'

type PendingNavigation = {
  sourceId: string
  target: string
  from: string
  spinner: boolean
}

export function createDashboardNavigationFeedback() {
  const pending = shallowRef<PendingNavigation | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer) clearTimeout(timer)
    timer = undefined
    pending.value = null
  }

  function begin(sourceId: string, target: string, from: string) {
    if (target === from || (pending.value?.sourceId === sourceId && pending.value.target === target)) return false
    clear()
    pending.value = { sourceId, target, from, spinner: false }
    timer = setTimeout(() => {
      if (pending.value?.sourceId === sourceId && pending.value.target === target) {
        pending.value = { ...pending.value, spinner: true }
      }
    }, 120)
    return true
  }

  function pageRendered(route: string) {
    if (pending.value?.target === route) clear()
  }

  function redirected(fromTarget: string, actualTarget: string) {
    if (pending.value?.target === fromTarget) {
      pending.value = { ...pending.value, target: actualTarget }
    }
  }

  function navigationFailed(target: string) {
    if (pending.value?.target === target) clear()
  }

  return {
    pending,
    begin,
    clear,
    isPending: (sourceId: string) => pending.value?.sourceId === sourceId,
    showSpinner: (sourceId: string) => pending.value?.sourceId === sourceId && pending.value.spinner,
    pageRendered,
    redirected,
    navigationFailed,
  }
}
