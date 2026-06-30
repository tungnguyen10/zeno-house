import { onBeforeRouteLeave } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Manages the "unsaved changes" guard for edit/create pages.
 *
 * - Blocks client-side navigation when `isDirty` is true (and `skip` is falsy).
 * - Shows a confirmation modal; user can confirm to proceed or cancel to stay.
 * - Registers a `beforeunload` handler for browser tab close / hard refresh.
 *
 * @param isDirty  Reactive flag — true when form has unsaved changes.
 * @param skip     Optional flag to bypass the guard (e.g. `isLoading` during save,
 *                 or a `skipDirtyGuard` set before programmatic navigation).
 */
export function useDirtyGuard(isDirty: Ref<boolean>, skip?: Ref<boolean>) {
  const showLeaveConfirm = ref(false)
  let pendingTo: RouteLocationRaw | null = null

  onBeforeRouteLeave((to) => {
    if (!isDirty.value || skip?.value) return
    pendingTo = to
    showLeaveConfirm.value = true
    return false
  })

  if (import.meta.client) {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty.value || skip?.value) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    onBeforeUnmount(() => window.removeEventListener('beforeunload', handler))
  }

  function confirmLeave() {
    showLeaveConfirm.value = false
    if (pendingTo) {
      navigateTo(pendingTo)
      pendingTo = null
    }
  }

  function cancelLeave() {
    showLeaveConfirm.value = false
    pendingTo = null
  }

  return { showLeaveConfirm, confirmLeave, cancelLeave }
}
