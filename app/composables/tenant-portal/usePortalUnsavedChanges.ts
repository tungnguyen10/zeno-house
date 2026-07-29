import type { Ref } from 'vue'

export function usePortalUnsavedChanges(dirty: Readonly<Ref<boolean>>) {
  const discardOpen = ref(false)
  let resolveLeave: ((allow: boolean) => void) | null = null
  let bypassOnce = false

  function resolvePending(allow: boolean) {
    const resolve = resolveLeave
    resolveLeave = null
    discardOpen.value = false
    resolve?.(allow)
  }

  function guardRouteLeave(): true | Promise<boolean> {
    if (bypassOnce) {
      bypassOnce = false
      return true
    }
    if (!dirty.value) return true

    discardOpen.value = true
    return new Promise<boolean>((resolve) => {
      resolveLeave = resolve
    })
  }

  function keepEditing() {
    resolvePending(false)
  }

  function discardChanges() {
    resolvePending(true)
  }

  function allowNextLeave() {
    bypassOnce = true
  }

  function onDiscardSheetUpdate(open: boolean) {
    if (open) {
      discardOpen.value = true
      return
    }
    keepEditing()
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value || bypassOnce) return
    event.preventDefault()
    event.returnValue = ''
  }

  return {
    discardOpen,
    guardRouteLeave,
    keepEditing,
    discardChanges,
    allowNextLeave,
    onDiscardSheetUpdate,
    onBeforeUnload,
  }
}
